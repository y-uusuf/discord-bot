const { MessageEmbed, MessageActionRow, MessageButton, Permissions } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "trial",
    async execute(client, message, args) {
        // 1. Permissions Check
        if (!message.member.permissions.has("ADMINISTRATOR")) {
            return message.reply("*sorry, only administrators can initiate a trial.*");
        }

        const target = message.mentions.members.first();
        if (!target) {
            return message.reply("*please mention a user to put on trial.*");
        }

        // 2. Settings Check
        const settings = await Settings.findOne({ guildId: message.guild.id });
        if (!settings?.trialChannel || !settings?.trialRole) {
            return message.reply("*trial channel or role not set. use `,set trial <#channel>` and `,set trialrole <@role>`.*");
        }

        const trialChannel = message.guild.channels.cache.get(settings.trialChannel);
        const trialRole = message.guild.roles.cache.get(settings.trialRole);

        if (!trialChannel || !trialRole) {
            return message.reply("*configured trial channel or role no longer exists.*");
        }

        // 3. Confirmation
        const confirmEmbed = new MessageEmbed()
            .setTitle("initiate trial?")
            .setDescription(`*are you sure you want to put **${target.user.username}** on trial?*`)
            .setFooter({ text: "warning: this will mute everyone else in the trial channel." });

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId("trial_confirm").setLabel("Confirm").setStyle("DANGER"),
            new MessageButton().setCustomId("trial_cancel").setLabel("Cancel").setStyle("SECONDARY")
        );

        const reply = await message.reply({ embeds: [confirmEmbed], components: [row] });

        // Create collector for confirmation
        const filter = i => i.user.id === message.author.id && ["trial_confirm", "trial_cancel"].includes(i.customId);

        let interaction;
        try {
            interaction = await reply.awaitMessageComponent({ filter, time: 30000 });
        } catch {
            return reply.edit({ content: "*timed out.*", embeds: [], components: [] });
        }

        if (interaction.customId === "trial_cancel") {
            return interaction.update({ content: "*trial cancelled.*", embeds: [], components: [] });
        }

        // 4. Trial Setup
        await interaction.deferUpdate();
        await reply.edit({ content: "*initiating trial...*", embeds: [], components: [] });

        // Mark trial as active
        if (client.trialActive) client.trialActive.add(message.guild.id);

        // Apply Role
        await target.roles.add(trialRole).catch(() => { });

        // Set Permissions: Everyone View+NoSend, Target View+Send
        await trialChannel.permissionOverwrites.set([
            {
                id: message.guild.id, // @everyone
                allow: [Permissions.FLAGS.VIEW_CHANNEL],
                deny: [Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.ADD_REACTIONS, Permissions.FLAGS.CREATE_PUBLIC_THREADS]
            },
            {
                id: target.id,
                allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES],
            },
            {
                id: client.user.id,
                allow: [Permissions.FLAGS.VIEW_CHANNEL, Permissions.FLAGS.SEND_MESSAGES, Permissions.FLAGS.MANAGE_MESSAGES]
            }
        ]);

        // Ping Everyone
        await trialChannel.send("@everyone");

        const bannerEmbed = new MessageEmbed()
            .setAuthor({ name: "fight for your stay.", iconURL: message.guild.iconURL() })
            .setDescription(`**${target.user.username}** is fighting for their stay in **${message.guild.name}**!`)
            .addFields(
                { name: "admin?", value: `${message.author}`, inline: true },
                { name: "victim?", value: `${target}`, inline: true },
                { name: "task?", value: "guess the number between **1 and 10**.\nyou have **3 attempts**.", inline: false }
            )
            .setColor("RED");

        await trialChannel.send({ embeds: [bannerEmbed] });

        // 5. Game Loop
        const winningNumber = Math.floor(Math.random() * 10) + 1;
        let attempts = 3;
        let won = false;

        // Collector for Game
        const gameFilter = m => m.author.id === target.id;
        const collector = trialChannel.createMessageCollector({
            filter: () => true, // Collect all to auto-delete invalid/others
            time: 60000 // 1 min time limit per guess or total? Let's say 2 mins total
        });

        collector.on('collect', async m => {
            // Auto-delete messages from anyone else
            if (m.author.id !== target.id && !m.author.bot) {
                await m.delete().catch(() => { });
                return;
            }

            // Auto-delete invalid messages from target? User said "if any message sent... auto delete so its clean"
            // But we need to check the guess first.

            if (m.author.id === target.id) {
                const guess = parseInt(m.content);

                if (isNaN(guess) || guess < 1 || guess > 10) {
                    const warning = await trialChannel.send(`*${target}, please enter a valid number between 1 and 10.*`);
                    setTimeout(() => warning.delete().catch(() => { }), 3000);
                    return;
                }

                attempts--;

                if (guess === winningNumber) {
                    won = true;
                    collector.stop("won");
                } else {
                    if (attempts <= 0) {
                        collector.stop("lost");
                    } else {
                        const wrong = await trialChannel.send(`*wrong number. ${attempts} attempts remaining.*`);
                        setTimeout(() => wrong.delete().catch(() => { }), 3000);
                    }
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === "won") {
                // WINNER
                // Revoke speaking permissions immediately
                await trialChannel.permissionOverwrites.edit(target.id, {
                    SEND_MESSAGES: false,
                    VIEW_CHANNEL: true
                });

                await trialChannel.send({ embeds: [new MessageEmbed().setTitle("TRIAL PASSED").setDescription(`**${target.user.username}** guessed the number (${winningNumber}) correctly and has been spared.`).setColor("GREEN")] });

                await target.roles.remove(trialRole).catch(() => { });

                // Cleanup Sequence
                setTimeout(() => cleanup(trialChannel, message, client), 60000); // 1 min wait

            } else {
                // LOSER - show buttons to admin
                const optionsRow = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("trial_kick").setLabel("Kick").setStyle("DANGER"),
                    new MessageButton().setCustomId("trial_ban").setLabel("Ban").setStyle("DANGER"),
                    new MessageButton().setCustomId("trial_spare").setLabel("Spare").setStyle("SUCCESS")
                );

                const outcomeMsg = await trialChannel.send({
                    content: `${message.author}, **${target.user.username}** failed to guess the number (${winningNumber}).`,
                    embeds: [new MessageEmbed().setTitle("JUDGEMENT REQUIRED").setDescription("Choose the fate of the defendant.").setColor("RED")],
                    components: [optionsRow]
                });

                // Await Admin Choice
                const btnFilter = i => i.user.id === message.author.id && ["trial_kick", "trial_ban", "trial_spare"].includes(i.customId);
                try {
                    const btnInteraction = await outcomeMsg.awaitMessageComponent({ filter: btnFilter, time: 60000 });

                    await btnInteraction.deferUpdate();

                    if (btnInteraction.customId === "trial_kick") {
                        await trialChannel.send(`**${target.user.username} has been KICKED.**`);
                        await target.kick("Trial failed").catch(e => trialChannel.send("Failed to kick."));
                    } else if (btnInteraction.customId === "trial_ban") {
                        await trialChannel.send(`**${target.user.username} has been BANNED.**`);
                        await target.ban({ reason: "Trial failed" }).catch(e => trialChannel.send("Failed to ban."));
                    } else {
                        await trialChannel.send(`**${target.user.username} has been SPARED.**`);
                        await target.roles.remove(trialRole).catch(() => { });
                    }

                    // Cleanup Sequence
                    setTimeout(() => cleanup(trialChannel, message, client), 60000);

                } catch (e) {
                    await trialChannel.send("Judgement timed out. Defaulting to Spare.");
                    await target.roles.remove(trialRole).catch(() => { });
                    setTimeout(() => cleanup(trialChannel, message, client), 60000);
                }
            }
        });
    }
};

async function cleanup(channel, message, client) {
    try {
        // Unmark trial active
        if (client && client.trialActive) client.trialActive.delete(message.guild.id);

        // Hide Channel
        await channel.permissionOverwrites.set([
            {
                id: message.guild.id, // @everyone
                deny: [Permissions.FLAGS.VIEW_CHANNEL]
            }
        ]);

        // Purge (Max 100 or loop?)
        // Simple purge 100
        await channel.bulkDelete(100, true).catch(() => { });

        // Send closed message
        // await channel.send("Trial concluded. Channel reset."); // Actually better to leave it empty and hidden
    } catch (e) {
        console.error("Trial cleanup failed:", e);
    }
}
