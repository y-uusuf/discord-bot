const { MessageEmbed, MessageActionRow, MessageButton, Permissions } = require("discord.js");
const Settings = require("../../models/settings");

module.exports = {
    name: "trial",
    async execute(client, message, args) {
        // 1. Permissions Check
        if (!message.member.permissions.has("ADMINISTRATOR")) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are missing **Administrator** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const target = message.mentions.members.first();
        if (!target) {
            const embed = new MessageEmbed()
                .setDescription(`⚖️ <@${message.author.id}>: please mention a user to put on trial`);
            return message.reply({ embeds: [embed] });
        }

        // 2. Settings Check
        const settings = await Settings.findOne({ guildId: message.guild.id });
        if (!settings?.trialChannel || !settings?.trialRole) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: trial channel or role not set. use \`,set trial <#channel>\` and \`,set trialrole <@role>\``);
            return message.reply({ embeds: [embed] });
        }

        const trialChannel = message.guild.channels.cache.get(settings.trialChannel);
        const trialRole = message.guild.roles.cache.get(settings.trialRole);

        if (!trialChannel || !trialRole) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: configured trial channel or role no longer exists`);
            return message.reply({ embeds: [embed] });
        }

        // 3. Confirmation
        const confirmEmbed = new MessageEmbed()
            .setDescription(`⚠️ <@${message.author.id}>: are you sure you want to put **${target.user.username}** on trial?`);

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
            const embed = new MessageEmbed()
                .setDescription(`⏰ <@${message.author.id}>: timed out`);
            return reply.edit({ embeds: [embed], components: [] });
        }

        if (interaction.customId === "trial_cancel") {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: trial cancelled`);
            return interaction.update({ embeds: [embed], components: [] });
        }

        // 4. Trial Setup
        await interaction.deferUpdate();
        await reply.edit({ content: "👍", embeds: [], components: [] });

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
            .setDescription(`⚖️ <@${message.author.id}>: **${target.user.username}** is fighting for their stay!\n\n**task:** guess the number between **1 and 10**. you have **3 attempts**.`);

        await trialChannel.send({ embeds: [bannerEmbed] });

        // 5. Game Loop
        const winningNumber = Math.floor(Math.random() * 10) + 1;
        let attempts = 3;
        let won = false;

        // Collector for Game
        const gameFilter = m => m.author.id === target.id;
        const collector = trialChannel.createMessageCollector({
            filter: () => true,
            time: 60000
        });

        collector.on('collect', async m => {
            if (m.author.id !== target.id && !m.author.bot) {
                await m.delete().catch(() => { });
                return;
            }

            if (m.author.id === target.id) {
                const guess = parseInt(m.content);

                if (isNaN(guess) || guess < 1 || guess > 10) {
                    const warning = await trialChannel.send({ embeds: [new MessageEmbed().setDescription(`❌ <@${target.id}>: please enter a valid number between 1 and 10`)] });
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
                        const wrong = await trialChannel.send({ embeds: [new MessageEmbed().setDescription(`❌ <@${target.id}>: wrong number. ${attempts} attempts remaining`)] });
                        setTimeout(() => wrong.delete().catch(() => { }), 3000);
                    }
                }
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === "won") {
                await trialChannel.permissionOverwrites.edit(target.id, {
                    SEND_MESSAGES: false,
                    VIEW_CHANNEL: true
                });

                await trialChannel.send({ embeds: [new MessageEmbed().setDescription(`✅ <@${message.author.id}>: **${target.user.username}** guessed correctly (${winningNumber}) and has been spared`)] });

                await target.roles.remove(trialRole).catch(() => { });

                setTimeout(() => cleanup(trialChannel, message, client), 60000);

            } else {
                const optionsRow = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("trial_kick").setLabel("Kick").setStyle("DANGER"),
                    new MessageButton().setCustomId("trial_ban").setLabel("Ban").setStyle("DANGER"),
                    new MessageButton().setCustomId("trial_spare").setLabel("Spare").setStyle("SUCCESS")
                );

                const outcomeMsg = await trialChannel.send({
                    embeds: [new MessageEmbed().setDescription(`⚖️ <@${message.author.id}>: **${target.user.username}** failed (answer was ${winningNumber}). choose their fate`)],
                    components: [optionsRow]
                });

                const btnFilter = i => i.user.id === message.author.id && ["trial_kick", "trial_ban", "trial_spare"].includes(i.customId);
                try {
                    const btnInteraction = await outcomeMsg.awaitMessageComponent({ filter: btnFilter, time: 60000 });

                    await btnInteraction.deferUpdate();

                    if (btnInteraction.customId === "trial_kick") {
                        await trialChannel.send({ embeds: [new MessageEmbed().setDescription(`👢 <@${message.author.id}>: **${target.user.username}** has been kicked`)] });
                        await target.kick("Trial failed").catch(() => { });
                    } else if (btnInteraction.customId === "trial_ban") {
                        await trialChannel.send({ embeds: [new MessageEmbed().setDescription(`🔨 <@${message.author.id}>: **${target.user.username}** has been banned`)] });
                        await target.ban({ reason: "Trial failed" }).catch(() => { });
                    } else {
                        await trialChannel.send({ embeds: [new MessageEmbed().setDescription(`✅ <@${message.author.id}>: **${target.user.username}** has been spared`)] });
                        await target.roles.remove(trialRole).catch(() => { });
                    }

                    setTimeout(() => cleanup(trialChannel, message, client), 60000);

                } catch (e) {
                    await trialChannel.send({ embeds: [new MessageEmbed().setDescription(`⏰ <@${message.author.id}>: timed out. defaulting to spare`)] });
                    await target.roles.remove(trialRole).catch(() => { });
                    setTimeout(() => cleanup(trialChannel, message, client), 60000);
                }
            }
        });
    }
};

async function cleanup(channel, message, client) {
    try {
        if (client && client.trialActive) client.trialActive.delete(message.guild.id);

        await channel.permissionOverwrites.set([
            {
                id: message.guild.id,
                deny: [Permissions.FLAGS.VIEW_CHANNEL]
            }
        ]);

        await channel.bulkDelete(100, true).catch(() => { });
    } catch (e) {
        console.error("Trial cleanup failed:", e);
    }
}
