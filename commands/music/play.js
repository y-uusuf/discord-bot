const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");
const { demuxProbe } = require("@discordjs/voice");
const { PassThrough } = require("stream");

const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    StreamType
} = require("@discordjs/voice");

const play = require("play-dl");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");

const fs = require("fs");
const os = require("os");
const path = require("path");

const ytDlpExec = require("yt-dlp-exec");

function clampVolume(requested, cap = 35) {
    const v = Number.isFinite(requested) ? requested : 100;
    return Math.max(1, Math.min(cap, v));
}


// Store active players, connections, audio resources, and idle timeouts
const players = new Map();
const connections = new Map();
const resources = new Map();     // For dynamic volume control
const idleTimeouts = new Map();  // For auto-disconnect after 1 minute

// ---- Cookie helpers (supports cloud-safe one-line env) ----
let cachedCookieFilePath = null;
let cachedCookieHeader = null;

function netscapeToCookieHeader(netscapeText) {
    const lines = String(netscapeText || "").split(/\r?\n/);
    const pairs = [];

    for (const line of lines) {
        if (!line || line.startsWith("#")) continue;
        const parts = line.split("\t");
        if (parts.length < 7) continue;

        const name = parts[5];
        const value = parts[6];
        if (!name || typeof value === "undefined") continue;

        pairs.push([name, value]);
    }

    const map = new Map();
    for (const [k, v] of pairs) map.set(k, v);

    return Array.from(map.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
}

function getCookieFilePathFromEnv() {
    if (cachedCookieFilePath) return cachedCookieFilePath;

    const b64 =
        process.env.YOUTUBE_COOKIES_B64 ||
        process.env.YOUTUBE_COOKIES_B65; // fallback support

    if (b64 && b64.trim()) {
        try {
            const buf = Buffer.from(b64.trim(), "base64");
            const tmpPath = path.join(os.tmpdir(), `youtube-cookies-${process.pid}.txt`);
            fs.writeFileSync(tmpPath, buf);
            cachedCookieFilePath = tmpPath;
            return cachedCookieFilePath;
        } catch (err) {
            console.error("Invalid base64 YouTube cookies:", err.message);
        }
    }

    if (process.env.YOUTUBE_COOKIES_PATH?.trim()) {
        cachedCookieFilePath = process.env.YOUTUBE_COOKIES_PATH.trim();
        return cachedCookieFilePath;
    }

    return null;
}


function getCookieHeaderFromEnv() {
    if (cachedCookieHeader) return cachedCookieHeader;

    // Cookie header directly
    if (process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.trim()) {
        cachedCookieHeader = process.env.YOUTUBE_COOKIES.trim();
        return cachedCookieHeader;
    }

    // Derive from netscape file
    const cookieFile = getCookieFilePathFromEnv();
    if (cookieFile) {
        try {
            const text = fs.readFileSync(cookieFile, "utf8");
            cachedCookieHeader = netscapeToCookieHeader(text);
            return cachedCookieHeader;
        } catch (_) {
            return null;
        }
    }

    return null;
}

// Initialize play-dl with cookies if available
(async () => {
    try {
        const cookieHeader = getCookieHeaderFromEnv();
        if (cookieHeader) {
            await play.setToken({
                youtube: { cookie: cookieHeader }
            });
            console.log("YouTube cookies loaded for play-dl");
        }
    } catch (err) {
        console.log("Failed to load YouTube cookies:", err.message);
    }
})();

// ---- yt-dlp helpers (fallback) ----
async function getSongInfoViaYtDlp(url) {
    // -J prints JSON metadata
    // Use a more bot-resistant client + cookies if available
    const cookieFile = getCookieFilePathFromEnv();

    const args = {
        dumpSingleJson: true,
        noPlaylist: true,
        skipDownload: true,
        quiet: true,
        // more resistant extractor args (helps on cloud IPs)
        extractorArgs: "youtube:player_client=android,player_skip=webpage,configs",
    };

    if (cookieFile) args.cookies = cookieFile;

    const json = await ytDlpExec(url, args);
    const title = json?.title || "Unknown";
    const channel = json?.uploader || json?.channel || "Unknown";
    const durationSec = json?.duration;
    const duration = typeof durationSec === "number"
        ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")}`
        : "?:??";

    const thumbnail = Array.isArray(json?.thumbnails) && json.thumbnails.length
        ? (json.thumbnails[json.thumbnails.length - 1]?.url || null)
        : (json?.thumbnail || null);

    return {
        title,
        url,
        duration,
        thumbnail,
        channel
    };
}

async function streamViaYtDlp(url, volumePercent) {
    const cookieFile = getCookieFilePathFromEnv();

    const child = ytDlpExec.exec(url, {
        output: "-",
        // Prefer opus-in-webm (best for Discord)
        format: "bestaudio[ext=webm][acodec=opus]/bestaudio",
        noPlaylist: true,
        quiet: true,
        noWarnings: true,
        ...(cookieFile ? { cookies: cookieFile } : {})
    });

    // Buffering: helps prevent tiny hiccups from becoming audible
    const pass = new PassThrough({ highWaterMark: 1 << 20 }); // 1MB buffer
    child.stdout.pipe(pass);

    // Probe container/codec so discord.js voice uses the correct type
    const { stream, type } = await demuxProbe(pass);

    const resource = createAudioResource(stream, {
        inputType: type,
        inlineVolume: true
    });

    // Cap + set volume
    const capped = clampVolume(volumePercent, 35); // cap at 35%
    resource.volume?.setVolume(capped / 100);

    child.stderr.on("data", (d) => {
        const msg = d.toString().trim();
        if (!msg) return;
        console.log("yt-dlp:", msg);
        if (msg.includes("ERROR")) {
            pass.destroy(new Error("yt-dlp: " + msg));
        }
    });

    child.on("error", (err) => {
        console.error("yt-dlp process error:", err.message || err);
        pass.destroy(err);
    });

    return { resource, child };
}


// ---- Core playback ----
async function playSong(guildId, client) {
    const session = await MusicSession.findOne({ guildId });
    if (!session || session.queue.length === 0) return;

    const song = session.queue[session.currentIndex];
    if (!song) return;

    // Clear any idle timeout since we're playing
    if (idleTimeouts.has(guildId)) {
        clearTimeout(idleTimeouts.get(guildId));
        idleTimeouts.delete(guildId);
    }

    const volume = clampVolume(session.volume || 100);

    console.log("Playing song:", song.title, "-", song.url);

    try {
        let resource;

        // Try yt-dlp first — it reliably streams audio on this setup.
        // Fall back to play-dl only if yt-dlp itself fails.
        try {
            const fallback = await streamViaYtDlp(song.url, volume);
            resource = fallback.resource;
        } catch (e) {
            console.log("yt-dlp stream failed, falling back to play-dl:", e?.message || e);
            const source = await play.stream(song.url, { quality: 2 });
            resource = createAudioResource(source.stream, {
                inputType: source.type,
                inlineVolume: true
            });
            resource.volume?.setVolume(volume / 100);
        }

        // Store resource for dynamic volume control
        resources.set(guildId, resource);

        const player = players.get(guildId);
        if (player) {
            player.play(resource);
            console.log("Started playing!");
        }

    } catch (err) {
        console.error("Error playing song:", err.message || err);

        // Skip to next song on error
        session.currentIndex++;
        if (session.currentIndex >= session.queue.length) {
            session.currentIndex = 0;
            session.queue = [];
            await session.save();
            return;
        }
        await session.save();
        playSong(guildId, client);
    }
}

// Function to update volume dynamically
function setVolume(guildId, volume) {
    const resource = resources.get(guildId);
    if (resource && resource.volume) {
        const v = clampVolume(volume, 35);
        resource.volume.setVolume(v / 100);
        return true;
    }
    return false;
}


module.exports = {
    name: "play",
    description: "Play music from YouTube",
    aliases: ["p"],
    players,
    connections,
    resources,
    idleTimeouts,
    playSong,
    setVolume,
    async execute(client, message, args) {
        if (!message.member.voice.channel) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: you must be in a voice channel.`);
            return message.reply({ embeds: [embed] });
        }

        const voiceChannel = message.member.voice.channel;
        const existingSession = await MusicSession.findOne({ guildId: message.guild.id });

        // Check if bot is already in use by someone else
        if (existingSession && existingSession.ownerId !== message.author.id) {
            const isAdmin = message.member.permissions.has("ADMINISTRATOR");
            if (!isAdmin) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`❌ <@${message.author.id}>: the bot is currently being used by <@${existingSession.ownerId}>.`);
                return message.reply({ embeds: [embed] });
            }
        }

        const query = args.join(" ");
        if (!query) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: please provide a song name or URL.`);
            return message.reply({ embeds: [embed] });
        }

        const isUrl = query.startsWith("http://") || query.startsWith("https://");

        try {
            let songInfo;

            if (isUrl) {
                // Direct URL: try play-dl info, fallback to yt-dlp info
                try {
                    const info = await play.video_info(query);
                    songInfo = {
                        title: info.video_details.title,
                        url: `https://www.youtube.com/watch?v=${info.video_details.videoId}`,
                        duration: info.video_details.durationRaw,
                        thumbnail: info.video_details.thumbnails[0]?.url,
                        channel: info.video_details.channel?.name || "Unknown"
                    };
                } catch (e) {
                    console.log("play-dl video_info failed, falling back to yt-dlp:", e?.message || e);
                    songInfo = await getSongInfoViaYtDlp(query);
                }
            } else {
                // Search YouTube
                const searchEmbed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`> 🔍 <@${message.author.id}>: searching for **${query}**...`);

                const searchMsg = await message.reply({ embeds: [searchEmbed] });

                const results = await play.search(query, { limit: 10 });
                if (!results || results.length === 0) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: no results found.`);
                    return searchMsg.edit({ embeds: [embed] });
                }

                const options = results.map((video, index) => ({
                    label: (video.title || "Unknown").substring(0, 100),
                    description: `${video.channel?.name || "Unknown"} • ${video.durationRaw || "?:??"}`.substring(0, 100),
                    value: index.toString()
                }));

                const row = new MessageActionRow().addComponents(
                    new MessageSelectMenu()
                        .setCustomId("music_select")
                        .setPlaceholder("select a song")
                        .addOptions(options)
                );

                const selectEmbed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`> 🎵 <@${message.author.id}>: select a song from the dropdown.`);

                await searchMsg.edit({ embeds: [selectEmbed], components: [row] });

                const filter = i => i.customId === "music_select" && i.user.id === message.author.id;
                const collected = await searchMsg.awaitMessageComponent({ filter, time: 30000 }).catch(() => null);

                if (!collected) {
                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: selection timed out.`);
                    return searchMsg.edit({ embeds: [embed], components: [] });
                }

                const selectedIndex = parseInt(collected.values[0], 10);
                const selected = results[selectedIndex];

                await collected.deferUpdate();

                const videoUrl = `https://www.youtube.com/watch?v=${selected.id}`;

                songInfo = {
                    title: selected.title || "Unknown",
                    url: videoUrl,
                    duration: selected.durationRaw || "?:??",
                    thumbnail: selected.thumbnails?.[0]?.url || null,
                    channel: selected.channel?.name || "Unknown"
                };

                await searchMsg.delete().catch(() => { });
            }

            // Join voice channel if not already connected
            let connection = connections.get(message.guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                    selfDeaf: true,
                    selfMute: false
                });

                connections.set(message.guild.id, connection);

                try {
                    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
                    console.log("Voice connection ready!");
                } catch (err) {
                    console.error("Voice connection failed:", err);
                    connection.destroy();
                    connections.delete(message.guild.id);

                    const embed = new MessageEmbed()
                        .setColor(config.embedColor)
                        .setDescription(`❌ <@${message.author.id}>: failed to connect to voice channel.`);
                    return message.reply({ embeds: [embed] });
                }

                const player = createAudioPlayer({
                    behaviors: {
                        noSubscriber: "pause",
                        maxMissedFrames: Math.round(5000 / 20)
                    }
                });

                players.set(message.guild.id, player);
                connection.subscribe(player);

                player.on("stateChange", async (oldState, newState) => {
                    console.log(`Player state: ${oldState.status} -> ${newState.status}`);

                    if (newState.status !== AudioPlayerStatus.Idle) return;

                    const session = await MusicSession.findOne({ guildId: message.guild.id });
                    if (!session) return;

                    if (session.loop === "song") {
                        playSong(message.guild.id, client);
                    } else {
                        session.currentIndex++;
                        if (session.currentIndex >= session.queue.length) {
                            if (session.loop === "queue") {
                                session.currentIndex = 0;
                            } else {
                                session.queue = [];
                                session.currentIndex = 0;
                                await session.save();

                                const timeout = setTimeout(async () => {
                                    console.log("Idle timeout - disconnecting...");
                                    const conn = connections.get(message.guild.id);
                                    if (conn) {
                                        conn.destroy();
                                        connections.delete(message.guild.id);
                                    }
                                    players.delete(message.guild.id);
                                    resources.delete(message.guild.id);
                                    idleTimeouts.delete(message.guild.id);
                                    await MusicSession.deleteOne({ guildId: message.guild.id });

                                    const textChannel = message.guild.channels.cache.get(session.textChannelId);
                                    if (textChannel) {
                                        const embed = new MessageEmbed()
                                            .setColor(config.embedColor)
                                            .setDescription(`> 👋 disconnected due to inactivity.`);
                                        textChannel.send({ embeds: [embed] }).catch(() => { });
                                    }
                                }, 60000);

                                idleTimeouts.set(message.guild.id, timeout);
                                return;
                            }
                        }
                        await session.save();
                        playSong(message.guild.id, client);
                    }
                });

                player.on("error", (error) => {
                    console.error("Audio player error:", error);
                });

                connection.on(VoiceConnectionStatus.Disconnected, async () => {
                    try {
                        await Promise.race([
                            entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                            entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                        ]);
                    } catch {
                        connection.destroy();
                        connections.delete(message.guild.id);
                        players.delete(message.guild.id);
                        await MusicSession.deleteOne({ guildId: message.guild.id });
                    }
                });
            }

            // Create or update session
            let session = await MusicSession.findOne({ guildId: message.guild.id });
            if (!session) {
                session = new MusicSession({
                    guildId: message.guild.id,
                    ownerId: message.author.id,
                    channelId: voiceChannel.id,
                    textChannelId: message.channel.id,
                    queue: [songInfo]
                });
            } else {
                session.queue.push(songInfo);
            }
            await session.save();

            // Start playing if this is the first song
            if (session.queue.length === 1) {
                playSong(message.guild.id, client);
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setThumbnail(songInfo.thumbnail)
                    .setDescription(`> 🎶 <@${message.author.id}>: now playing **${songInfo.title}**\n> Channel: **${songInfo.channel}** • Duration: **${songInfo.duration}**`);
                message.channel.send({ embeds: [embed] });
            } else {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(`> ➕ <@${message.author.id}>: added **${songInfo.title}** to queue (position ${session.queue.length})`);
                message.channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error("Play command error:", error);
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: failed to play song.`);
            message.reply({ embeds: [embed] });
        }
    }
};