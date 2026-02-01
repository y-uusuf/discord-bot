const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType } = require("@discordjs/voice");
const play = require("play-dl");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");

// Initialize play-dl with cookies from env if available
(async () => {
    try {
        if (process.env.YOUTUBE_COOKIES) {
            let cookieString = process.env.YOUTUBE_COOKIES;

            // Check if it's JSON format and convert to string format
            if (cookieString.trim().startsWith('[')) {
                const cookies = JSON.parse(cookieString);
                cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
            }

            await play.setToken({
                youtube: {
                    cookie: cookieString
                }
            });
            console.log("YouTube cookies loaded from env!");
        }
    } catch (err) {
        console.log("Failed to load YouTube cookies:", err.message);
    }
})();

// Store active players, connections, audio resources, and idle timeouts
const players = new Map();
const connections = new Map();
const resources = new Map();  // For dynamic volume control
const idleTimeouts = new Map();  // For auto-disconnect after 1 minute

// ---- Cookie helpers (supports cloud-safe one-line env) ----
let cachedCookieFilePath = null;
let cachedCookieHeader = null;

function netscapeToCookieHeader(netscapeText) {
    // Parse Netscape cookie file -> "name=value; name2=value2"
    // Ignores comments and invalid lines.
    const lines = String(netscapeText || "").split(/\r?\n/);
    const pairs = [];

    for (const line of lines) {
        if (!line || line.startsWith("#")) continue;

        // Netscape format has tab-separated fields, cookie name is 6th, value is 7th
        const parts = line.split("\t");
        if (parts.length < 7) continue;

        const name = parts[5];
        const value = parts[6];

        if (!name || typeof value === "undefined") continue;

        // Avoid duplicates by keeping last occurrence
        pairs.push([name, value]);
    }

    // Deduplicate (keep last)
    const map = new Map();
    for (const [k, v] of pairs) map.set(k, v);

    return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

function getCookieFilePathFromEnv() {
    if (cachedCookieFilePath) return cachedCookieFilePath;

    // Priority 1: base64 (single line) netscape cookie file
    if (process.env.YOUTUBE_COOKIES_B64 && process.env.YOUTUBE_COOKIES_B64.trim()) {
        try {
            const buf = Buffer.from(process.env.YOUTUBE_COOKIES_B64.trim(), "base64");
            const tmpPath = path.join(os.tmpdir(), `youtube-cookies-${process.pid}.txt`);
            fs.writeFileSync(tmpPath, buf);
            cachedCookieFilePath = tmpPath;
            return cachedCookieFilePath;
        } catch (e) {
            // fall through
        }
    }

    // Priority 2: explicit file path
    if (process.env.YOUTUBE_COOKIES_PATH && process.env.YOUTUBE_COOKIES_PATH.trim()) {
        cachedCookieFilePath = process.env.YOUTUBE_COOKIES_PATH.trim();
        return cachedCookieFilePath;
    }

    return null;
}

function getCookieHeaderFromEnv() {
    if (cachedCookieHeader) return cachedCookieHeader;

    // If user provides a cookie header directly
    if (process.env.YOUTUBE_COOKIES && process.env.YOUTUBE_COOKIES.trim()) {
        cachedCookieHeader = process.env.YOUTUBE_COOKIES.trim();
        return cachedCookieHeader;
    }

    // Otherwise derive cookie header from netscape file content if present
    const cookieFile = getCookieFilePathFromEnv();
    if (cookieFile) {
        try {
            const text = fs.readFileSync(cookieFile, "utf8");
            cachedCookieHeader = netscapeToCookieHeader(text);
            return cachedCookieHeader;
        } catch (e) {
            return null;
        }
    }

    return null;
}

// Initialize play-dl with cookies if available (does not log cookies)
(async () => {
    try {
        const cookieHeader = getCookieHeaderFromEnv();
        if (cookieHeader) {
            await play.setToken({
                youtube: {
                    cookie: cookieHeader
                }
            });
            console.log("YouTube cookies loaded for play-dl");
        }
    } catch (err) {
        console.log("Failed to load YouTube cookies:", err.message);
    }
})();

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

    console.log("Playing song:", song.title, "-", song.url);

    try {
        // Use play-dl to stream (has better YouTube handling)
        const source = await play.stream(song.url, { quality: 2 });

        const resource = createAudioResource(source.stream, {
            inputType: source.type,
            inlineVolume: true
        });
        resource.volume?.setVolume(session.volume / 100);

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
        resource.volume.setVolume(volume / 100);
        return true;
    }
    return false;
}

module.exports = {
    name: "play",
    description: "Play music from YouTube",
    aliases: ["p"],
    async execute(client, message, args) {
        if (!message.member.voice.channel) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you must be in a voice channel.`);
            return message.reply({ embeds: [embed] });
        }

        const voiceChannel = message.member.voice.channel;
        const existingSession = await MusicSession.findOne({ guildId: message.guild.id });

        // Check if bot is already in use by someone else
        if (existingSession && existingSession.ownerId !== message.author.id) {
            const isAdmin = message.member.permissions.has("ADMINISTRATOR");
            if (!isAdmin) {
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: the bot is currently being used by <@${existingSession.ownerId}>.`);
                return message.reply({ embeds: [embed] });
            }
        }

        const query = args.join(" ");
        if (!query) {
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please provide a song name or URL.`);
            return message.reply({ embeds: [embed] });
        }

        // Check if it's a URL
        const isUrl = query.startsWith("http://") || query.startsWith("https://");

        try {
            let songInfo;

            if (isUrl) {
                // Direct URL
                const info = await play.video_info(query);
                songInfo = {
                    title: info.video_details.title,
                    url: info.video_details.url,
                    duration: info.video_details.durationRaw,
                    thumbnail: info.video_details.thumbnails[0]?.url,
                    channel: info.video_details.channel?.name || "Unknown"
                };
            } else {
                // Search YouTube
                const searchEmbed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🔍 <@${message.author.id}>: searching for **${query}**...`);
                const searchMsg = await message.reply({ embeds: [searchEmbed] });

                const results = await play.search(query, { limit: 10 });
                if (!results || results.length === 0) {
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no results found.`);
                    return searchMsg.edit({ embeds: [embed] });
                }

                // Debug log first result structure
                console.log("First search result:", JSON.stringify(results[0], null, 2));

                // Create dropdown menu
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

                // Wait for selection
                const filter = i => i.customId === "music_select" && i.user.id === message.author.id;
                const collected = await searchMsg.awaitMessageComponent({ filter, time: 30000 }).catch(() => null);

                if (!collected) {
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: selection timed out.`);
                    return searchMsg.edit({ embeds: [embed], components: [] });
                }

                const selectedIndex = parseInt(collected.values[0]);
                const selected = results[selectedIndex];

                // Immediately acknowledge the interaction to prevent timeout
                await collected.deferUpdate();

                // Get the video URL - play-dl uses 'url' property
                const videoUrl = selected.url || `https://www.youtube.com/watch?v=${selected.id}`;
                console.log("Selected video URL:", videoUrl);

                songInfo = {
                    title: selected.title || "Unknown",
                    url: videoUrl,
                    duration: selected.durationRaw || "?:??",
                    thumbnail: selected.thumbnails?.[0]?.url || null,
                    channel: selected.channel?.name || "Unknown"
                };

                console.log("Song info:", songInfo);

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

                // Wait for connection to be ready
                try {
                    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
                    console.log("Voice connection ready!");
                } catch (err) {
                    console.error("Voice connection failed:", err);
                    connection.destroy();
                    connections.delete(message.guild.id);
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: failed to connect to voice channel.`);
                    return message.reply({ embeds: [embed] });
                }

                const player = createAudioPlayer();
                players.set(message.guild.id, player);
                connection.subscribe(player);

                // Log player state changes
                player.on("stateChange", (oldState, newState) => {
                    console.log(`Player state: ${oldState.status} -> ${newState.status}`);
                });

                // Handle player events
                player.on(AudioPlayerStatus.Idle, async () => {
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
                                // Queue finished - set 1 minute idle timeout
                                session.queue = [];
                                session.currentIndex = 0;
                                await session.save();

                                // Start 1 minute idle timeout for auto-disconnect
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

                                    // Notify in text channel
                                    const textChannel = message.guild.channels.cache.get(session.textChannelId);
                                    if (textChannel) {
                                        const embed = new MessageEmbed()
                                            .setColor(config.embedColor)
                                            .setDescription(`> 👋 disconnected due to inactivity.`);
                                        textChannel.send({ embeds: [embed] }).catch(() => { });
                                    }
                                }, 60000); // 1 minute

                                idleTimeouts.set(message.guild.id, timeout);
                                return;
                            }
                        }
                        await session.save();
                        playSong(message.guild.id, client);
                    }
                });

                player.on("error", error => {
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
            const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: failed to play song.`);
            message.reply({ embeds: [embed] });
        }
    }
};

// Export utilities for other commands
module.exports.players = players;
module.exports.connections = connections;
module.exports.resources = resources;
module.exports.idleTimeouts = idleTimeouts;
module.exports.playSong = playSong;
module.exports.setVolume = setVolume;
