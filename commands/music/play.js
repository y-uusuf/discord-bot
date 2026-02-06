const { MessageEmbed, MessageActionRow, MessageSelectMenu } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, StreamType } = require("@discordjs/voice");
const play = require("play-dl");
const { spawn } = require("child_process");
const config = require("../../config.json");
const MusicSession = require("../../models/musicSession");

// Configure FFmpeg path
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;


// SoundCloud initialization flag
let soundcloudReady = false;

// Initialize play-dl for SoundCloud
async function initSoundCloud() {
    if (soundcloudReady) return true;

    try {
        const clientID = await play.getFreeClientID();
        await play.setToken({
            soundcloud: {
                client_id: clientID
            }
        });
        soundcloudReady = true;

        return true;
    } catch (err) {

        return false;
    }
}

// Store active players, connections, audio resources, FFmpeg processes, and idle timeouts
const players = new Map();
const connections = new Map();
const resources = new Map();
const ffmpegProcesses = new Map();
const idleTimeouts = new Map();

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

    // Kill any existing FFmpeg process for this guild
    if (ffmpegProcesses.has(guildId)) {
        const oldProcess = ffmpegProcesses.get(guildId);
        oldProcess.kill('SIGKILL');
        ffmpegProcesses.delete(guildId);
    }



    try {
        // Get the raw stream from play-dl
        const streamInfo = await play.stream(song.url);

        // Spawn FFmpeg with lower quality for smoother playback
        const ffmpegProcess = spawn(ffmpegPath, [
            '-i', 'pipe:0',
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-b:a', '96k',
            'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'ignore'] });

        // Store FFmpeg process for cleanup
        ffmpegProcesses.set(guildId, ffmpegProcess);

        // Handle stream errors gracefully
        streamInfo.stream.on('error', (err) => { console.error("Stream Error:", err); });
        ffmpegProcess.stdin.on('error', (err) => { console.error("FFmpeg Stdin Error:", err); });
        ffmpegProcess.stdout.on('error', (err) => { console.error("FFmpeg Stdout Error:", err); });
        ffmpegProcess.on('close', (code) => { if (code !== 0) console.error("FFmpeg exited with code:", code); });

        // Pipe the audio stream through FFmpeg
        streamInfo.stream.pipe(ffmpegProcess.stdin);

        const resource = createAudioResource(ffmpegProcess.stdout, {
            inputType: StreamType.Raw,
            inlineVolume: true
        });
        resource.volume?.setVolume(session.volume / 100);

        // Store resource for dynamic volume control
        resources.set(guildId, resource);

        const player = players.get(guildId);
        if (player) {
            player.play(resource);

        }

    } catch (err) {

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
    description: "Play music from SoundCloud",
    aliases: ["p"],
    async execute(client, message, args) {
        // Initialize SoundCloud if not ready
        if (!soundcloudReady) {
            const initialized = await initSoundCloud();
            if (!initialized) {
                const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: failed to initialize SoundCloud. Please try again.`);
                return message.reply({ embeds: [embed] });
            }
        }

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

        // Check if it's a SoundCloud URL
        const isSoundCloudUrl = query.includes("soundcloud.com");

        try {
            let songInfo;

            if (isSoundCloudUrl) {
                // Direct SoundCloud URL
                const info = await play.soundcloud(query);
                songInfo = {
                    title: info.name,
                    url: info.url,
                    duration: formatDuration(info.durationInSec),
                    thumbnail: info.thumbnail,
                    channel: info.user?.name || "Unknown"
                };
            } else {
                // Search SoundCloud
                const searchEmbed = new MessageEmbed().setColor(config.embedColor).setDescription(`> 🔍 <@${message.author.id}>: searching SoundCloud for **${query}**...`);
                const searchMsg = await message.reply({ embeds: [searchEmbed] });

                const results = await play.search(query, {
                    source: { soundcloud: 'tracks' },
                    limit: 20  // Get more results to filter
                });

                if (!results || results.length === 0) {
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: no results found on SoundCloud.`);
                    return searchMsg.edit({ embeds: [embed] });
                }

                // Sort by relevance - prioritize exact title matches and verified artists
                const queryLower = query.toLowerCase();
                const sortedResults = results
                    .map(track => {
                        const titleLower = (track.name || track.title || "").toLowerCase();
                        let score = 0;

                        // Exact match gets highest score
                        if (titleLower === queryLower) score += 100;

                        // Title starts with query
                        if (titleLower.startsWith(queryLower)) score += 50;

                        // Title contains query
                        if (titleLower.includes(queryLower)) score += 25;

                        // Verified artist bonus
                        if (track.user?.verified) score += 10;

                        // More plays = more relevant (normalize to 0-10 range)
                        if (track.playCount) score += Math.min(track.playCount / 100000, 10);

                        return { track, score };
                    })
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 10)  // Take top 10 most relevant
                    .map(item => item.track);

                // Create dropdown menu
                const options = sortedResults.map((track, index) => ({
                    label: (track.name || track.title || "Unknown").substring(0, 100),
                    description: `${track.user?.name || track.channel?.name || "Unknown"} • ${formatDuration(track.durationInSec)}`.substring(0, 100),
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
                const selected = sortedResults[selectedIndex];

                songInfo = {
                    title: selected.name || selected.title || "Unknown",
                    url: selected.url,
                    duration: formatDuration(selected.durationInSec),
                    thumbnail: selected.thumbnail,
                    channel: selected.user?.name || selected.channel?.name || "Unknown"
                };

                await collected.deferUpdate();
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

                } catch (err) {

                    connection.destroy();
                    connections.delete(message.guild.id);
                    const embed = new MessageEmbed().setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: failed to connect to voice channel.`);
                    return message.reply({ embeds: [embed] });
                }

                const player = createAudioPlayer();
                players.set(message.guild.id, player);
                connection.subscribe(player);

                // Handle player events
                player.on(AudioPlayerStatus.Idle, async () => {
                    const session = await MusicSession.findOne({ guildId: message.guild.id });
                    if (!session) return;

                    if (session.loop === 'song') {
                        playSong(message.guild.id, client);
                    } else {
                        session.currentIndex++;
                        if (session.currentIndex >= session.queue.length) {
                            if (session.loop === 'queue') {
                                session.currentIndex = 0;
                            } else {
                                // Queue finished - set 1 minute idle timeout
                                session.queue = [];
                                session.currentIndex = 0;
                                await session.save();

                                const timeout = setTimeout(async () => {

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

                player.on('error', error => {
                    console.error('Audio player error:', error);
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
                    .setDescription(`> 🎶 <@${message.author.id}>: now playing **${songInfo.title}**\n> Artist: **${songInfo.channel}** • Duration: **${songInfo.duration}**`);
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

// Helper function to format duration
function formatDuration(seconds) {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Export utilities for other commands
module.exports.players = players;
module.exports.connections = connections;
module.exports.resources = resources;
module.exports.ffmpegProcesses = ffmpegProcesses;
module.exports.idleTimeouts = idleTimeouts;
module.exports.playSong = playSong;
module.exports.setVolume = setVolume;