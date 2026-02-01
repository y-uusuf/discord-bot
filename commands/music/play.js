const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
    demuxProbe,
} = require("@discordjs/voice");
const { PassThrough } = require("stream");

const play = require("play-dl");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");

const fs = require("fs");
const os = require("os");
const path = require("path");
const ytDlpExec = require("yt-dlp-exec");

// =================== helpers ===================
const VOLUME_CAP = 25; // lower = more headroom, less distortion

function clampVolume(requested, cap = VOLUME_CAP) {
    const n = Number(requested);
    const v = Number.isFinite(n) ? n : 100;
    return Math.max(1, Math.min(cap, v));
}

function safeB64(str) {
    return String(str || "").replace(/\s+/g, "").trim();
}

function ensureTmpCookieFile(contentsOrPath, mode) {
    // mode: "b64" | "path"
    const tmpPath = path.join(os.tmpdir(), `youtube-cookies-${process.pid}.txt`);

    if (mode === "b64") {
        const buf = Buffer.from(contentsOrPath, "base64");
        fs.writeFileSync(tmpPath, buf);
        return tmpPath;
    }

    // mode === "path": copy secret file (read-only) to /tmp (writable)
    fs.copyFileSync(contentsOrPath, tmpPath);
    return tmpPath;
}

// Store active players, connections, audio resources, and idle timeouts
const players = new Map();
const connections = new Map();
const resources = new Map();
const idleTimeouts = new Map();

// ---- Cookie helpers ----
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

    // Priority 1: base64 netscape cookie file
    const rawB64 = process.env.YOUTUBE_COOKIES_B64 || process.env.YOUTUBE_COOKIES_B65;
    const b64 = safeB64(rawB64);
    if (b64) {
        try {
            cachedCookieFilePath = ensureTmpCookieFile(b64, "b64");
            return cachedCookieFilePath;
        } catch (err) {
            console.error("Invalid base64 YouTube cookies:", err.message);
        }
    }

    // Priority 2: secret file path (Render secret files are read-only -> copy to /tmp)
    if (process.env.YOUTUBE_COOKIES_PATH && process.env.YOUTUBE_COOKIES_PATH.trim()) {
        const src = process.env.YOUTUBE_COOKIES_PATH.trim();
        try {
            cachedCookieFilePath = ensureTmpCookieFile(src, "path");
            return cachedCookieFilePath;
        } catch (err) {
            console.error("Failed to copy cookies secret file:", err.message);
            return null;
        }
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

    // Derive from netscape file (from /tmp copy)
    const cookieFile = getCookieFilePathFromEnv();
    if (cookieFile) {
        try {
            const text = fs.readFileSync(cookieFile, "utf8");
            cachedCookieHeader = netscapeToCookieHeader(text);
            return cachedCookieHeader;
        } catch (err) {
            console.error("Failed to read cookie file:", err.message);
            return null;
        }
    }
    return null;
}

function debugCookieFileOnce() {
    const cookieFile = getCookieFilePathFromEnv();
    if (!cookieFile) {
        console.log("[cookies] No cookie file found from env.");
        return;
    }
    try {
        const stat = fs.statSync(cookieFile);
        const firstLine = fs.readFileSync(cookieFile, "utf8").split(/\r?\n/)[0] || "";
        console.log(`[cookies] cookieFile=${cookieFile} size=${stat.size} firstLine="${firstLine}"`);
    } catch (e) {
        console.log("[cookies] Could not stat/read cookie file:", e.message);
    }
}

// Initialize play-dl with cookies if available
(async () => {
    try {
        debugCookieFileOnce();
        const cookieHeader = getCookieHeaderFromEnv();
        if (cookieHeader) {
            await play.setToken({ youtube: { cookie: cookieHeader } });
            console.log("YouTube cookies loaded for play-dl");
        } else {
            console.log("No YouTube cookies header available for play-dl.");
        }
    } catch (err) {
        console.log("Failed to load YouTube cookies:", err.message);
    }
})();

// ---- yt-dlp helpers ----
async function getSongInfoViaYtDlp(url) {
    const cookieFile = getCookieFilePathFromEnv();
    const args = {
        dumpSingleJson: true,
        noPlaylist: true,
        skipDownload: true,
        quiet: true,
        ...(cookieFile ? { cookies: cookieFile } : {}),
    };

    const json = await ytDlpExec(url, args);
    const title = json?.title || "Unknown";
    const channel = json?.uploader || json?.channel || "Unknown";
    const durationSec = json?.duration;

    const duration =
        typeof durationSec === "number"
            ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, "0")}`
            : "?:??";

    const thumbnail =
        Array.isArray(json?.thumbnails) && json.thumbnails.length
            ? json.thumbnails[json.thumbnails.length - 1]?.url || null
            : json?.thumbnail || null;

    return { title, url, duration, thumbnail, channel };
}

async function streamViaYtDlp(url, volumePercent) {
    const cookieFile = getCookieFilePathFromEnv();

    const child = ytDlpExec.exec(url, {
        output: "-",
        // ✅ fallback chain - avoids "Requested format is not available"
        format: "bestaudio[acodec=opus]/bestaudio[ext=webm]/bestaudio",
        noPlaylist: true,
        quiet: true,
        noWarnings: true,
        userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        ...(cookieFile ? { cookies: cookieFile } : {}),
    });

    // ✅ bigger buffer for cloud smoothness
    const pass = new PassThrough({ highWaterMark: 2 << 20 }); // 2MB
    child.stdout.pipe(pass);

    const { stream, type } = await demuxProbe(pass);

    const resource = createAudioResource(stream, {
        inputType: type,
        inlineVolume: true,
    });

    const capped = clampVolume(volumePercent, VOLUME_CAP);
    resource.volume?.setVolume(capped / 100);

    child.stderr.on("data", (d) => {
        const msg = d.toString().trim();
        if (!msg) return;

        // Only log + kill on real fatal issues (avoid killing on harmless stderr)
        if (msg.includes("Sign in to confirm") || msg.includes("Requested format is not available")) {
            console.log("yt-dlp:", msg);
            pass.destroy(new Error("yt-dlp fatal: " + msg));
            return;
        }

        // optional: log other errors without killing immediately
        if (msg.startsWith("ERROR:")) {
            console.log("yt-dlp:", msg);
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

    const volume = clampVolume(session.volume || 100, VOLUME_CAP);
    console.log("Playing song:", song.title, "-", song.url);

    try {
        let resource;

        try {
            const fallback = await streamViaYtDlp(song.url, volume);
            resource = fallback.resource;
        } catch (e) {
            console.log("yt-dlp stream failed, falling back to play-dl:", e?.message || e);
            const source = await play.stream(song.url, { quality: 2 });
            resource = createAudioResource(source.stream, {
                inputType: source.type,
                inlineVolume: true,
            });
            resource.volume?.setVolume(volume / 100);
        }

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
        const v = clampVolume(volume, VOLUME_CAP);
        resource.volume.setVolume(v / 100);
        return true;
    }
    return false;
}

// ---- command ----
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

        // bot in use by someone else
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
                        channel: info.video_details.channel?.name || "Unknown",
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
                    value: index.toString(),
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

                const filter = (i) => i.customId === "music_select" && i.user.id === message.author.id;
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
                    channel: selected.channel?.name || "Unknown",
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
                    selfMute: false,
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
                        maxMissedFrames: Math.round(5000 / 20),
                    },
                });

                players.set(message.guild.id, player);
                connection.subscribe(player);

                player.on("stateChange", async (oldState, newState) => {
                    console.log(`Player state: ${oldState.status} -> ${newState.status}`);
                    if (newState.status !== AudioPlayerStatus.Idle) return;

                    const s = await MusicSession.findOne({ guildId: message.guild.id });
                    if (!s) return;

                    if (s.loop === "song") {
                        playSong(message.guild.id, client);
                        return;
                    }

                    s.currentIndex++;
                    if (s.currentIndex >= s.queue.length) {
                        if (s.loop === "queue") {
                            s.currentIndex = 0;
                        } else {
                            s.queue = [];
                            s.currentIndex = 0;
                            await s.save();

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

                                const textChannel = message.guild.channels.cache.get(s.textChannelId);
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

                    await s.save();
                    playSong(message.guild.id, client);
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
                        resources.delete(message.guild.id);
                        idleTimeouts.delete(message.guild.id);
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
                    queue: [songInfo],
                    currentIndex: 0,
                    volume: VOLUME_CAP,
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
                    .setDescription(
                        `> 🎶 <@${message.author.id}>: now playing **${songInfo.title}**\n> Channel: **${songInfo.channel}** • Duration: **${songInfo.duration}**`
                    );
                message.channel.send({ embeds: [embed] });
            } else {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor)
                    .setDescription(
                        `> ➕ <@${message.author.id}>: added **${songInfo.title}** to queue (position ${session.queue.length})`
                    );
                message.channel.send({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Play command error:", error);
            const embed = new MessageEmbed()
                .setColor(config.embedColor)
                .setDescription(`❌ <@${message.author.id}>: failed to play song.`);
            message.reply({ embeds: [embed] });
        }
    },
};
