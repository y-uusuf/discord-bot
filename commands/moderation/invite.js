const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

module.exports = {
    name: "invite",
    description: "Manage server invites.",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_GUILD")) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are missing **Manage Server** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        const rawArg = args[0];
        const sub = rawArg?.toLowerCase();

        // --- SHOW HELP ---
        if (!sub) {
            const embed = new MessageEmbed()
                .setDescription(`🔗 <@${message.author.id}>: manage server invites.\n\n**subcommands:**\n\`list\` - list all invites\n\`delete <code>\` - delete an invite\n\`delete all\` - delete all invites\n\`<code>\` - check invite info`);
            return message.reply({ embeds: [embed] });
        }

        // --- LIST INVITES ---
        if (sub === "list") {
            const invites = await message.guild.invites.fetch();
            if (invites.size === 0) {
                const embed = new MessageEmbed()
                    .setDescription(`🔗 <@${message.author.id}>: this server has no active invites`);
                return message.reply({ embeds: [embed] });
            }

            const sortedInvites = invites.sort((a, b) => b.uses - a.uses);
            const displayInvites = sortedInvites.first(15);
            const list = displayInvites.map(inv =>
                `\`${inv.code}\` - **${inv.uses}** uses - by ${inv.inviter?.tag || "Unknown"}`
            ).join("\n");

            const embed = new MessageEmbed()
                .setDescription(`🔗 <@${message.author.id}>: server invites (${invites.size})\n\n${list}${invites.size > 15 ? `\n\n...and ${invites.size - 15} more.` : ""}`);

            return message.reply({ embeds: [embed] });
        }

        // --- DELETE INVITE(S) ---
        if (sub === "delete") {
            const target = args[1];

            if (!target) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: please specify a code to delete, or use \`all\``);
                return message.reply({ embeds: [embed] });
            }

            // DELETE ALL
            if (target.toLowerCase() === "all" || target.toLowerCase() === "invites") {
                const confirmEmbed = new MessageEmbed()
                    .setDescription(`⚠️ <@${message.author.id}>: are you sure you want to delete **ALL** invites?`);

                const row = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("invite_delete_all_confirm").setLabel("Confirm").setStyle("DANGER"),
                    new MessageButton().setCustomId("invite_delete_all_cancel").setLabel("Cancel").setStyle("SECONDARY")
                );

                const prompt = await message.reply({ embeds: [confirmEmbed], components: [row] });

                const filter = i => i.user.id === message.author.id && ["invite_delete_all_confirm", "invite_delete_all_cancel"].includes(i.customId);
                try {
                    const interaction = await prompt.awaitMessageComponent({ filter, time: 15000 });

                    if (interaction.customId === "invite_delete_all_cancel") {
                        const embed = new MessageEmbed()
                            .setDescription(`❌ <@${message.author.id}>: cancelled`);
                        return interaction.update({ embeds: [embed], components: [] });
                    }

                    await interaction.update({ content: "👍", embeds: [], components: [] });

                    const invites = await message.guild.invites.fetch();
                    for (const invite of invites.values()) {
                        await invite.delete().catch(() => { });
                    }

                } catch (e) {
                    const embed = new MessageEmbed()
                        .setDescription(`⏰ <@${message.author.id}>: timed out`);
                    return prompt.edit({ embeds: [embed], components: [] }).catch(() => { });
                }
                return;
            }

            // DELETE SPECIFIC CODE
            try {
                const invite = await message.guild.invites.fetch(target).catch(() => null);
                if (!invite) {
                    const embed = new MessageEmbed()
                        .setDescription(`❌ <@${message.author.id}>: invite not found`);
                    return message.reply({ embeds: [embed] });
                }

                await invite.delete();
                const embed = new MessageEmbed()
                    .setDescription(`🔗 <@${message.author.id}>: deleted invite \`${target}\``);
                return message.reply({ embeds: [embed] });
            } catch (e) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: failed to delete invite`);
                return message.reply({ embeds: [embed] });
            }
        }

        // --- CHECK INFO ---
        const inviteCode = rawArg;
        try {
            const invite = await client.fetchInvite(inviteCode).catch(() => null);

            if (!invite) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: invalid invite code or invite expired`);
                return message.reply({ embeds: [embed] });
            }

            if (!invite.guild) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: invite does not belong to a server`);
                return message.reply({ embeds: [embed] });
            }

            if (invite.guild.id !== message.guild.id) {
                const embed = new MessageEmbed()
                    .setDescription(`❌ <@${message.author.id}>: that invite is for a different server`);
                return message.reply({ embeds: [embed] });
            }

            const embed = new MessageEmbed()
                .setDescription(`🔗 <@${message.author.id}>: invite info for \`${inviteCode}\`\n\n**channel:** ${invite.channel ? `<#${invite.channel.id}>` : "unknown"}\n**creator:** ${invite.inviter?.tag || "Unknown"}\n**uses:** ${invite.uses || 0} / ${invite.maxUses || "∞"}\n**expires:** ${invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : "never"}`);

            return message.reply({ embeds: [embed] });

        } catch (e) {
            console.error(e);
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: could not fetch invite info`);
            return message.reply({ embeds: [embed] });
        }
    }
};
