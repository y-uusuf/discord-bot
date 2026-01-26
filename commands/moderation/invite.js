const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

module.exports = {
    name: "invite",
    description: "Manage server invites.",
    async execute(client, message, args) {
        if (!message.member.permissions.has("MANAGE_GUILD")) {
            return message.reply("*sorry, you need 'Manage Server' permission to manage invites.*");
        }

        const rawArg = args[0];
        const sub = rawArg?.toLowerCase();

        // --- SHOW HELP ---
        if (!sub) {
            const embed = new MessageEmbed()
                .setTitle("invite command")
                .setDescription("*manage server invites.*")
                .addFields(
                    { name: "```usage```", value: "`,invite <subcommand> <args>`", inline: false },
                    { name: "```subcommands```", value: "`list` - list all invites\n`delete` - delete an invite or all\n`<code>` - check invite info", inline: false },
                    { name: "```examples```", value: "`,invite list`\n`,invite delete all`\n`,invite delete <invite_code>`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        // --- LIST INVITES ---
        if (sub === "list") {
            const invites = await message.guild.invites.fetch();
            if (invites.size === 0) {
                return message.reply("*this server has no active invites.*");
            }

            // Sort by uses (descending)
            const sortedInvites = invites.sort((a, b) => b.uses - a.uses);

            // Truncate to top 15 to fit in embed
            const displayInvites = sortedInvites.first(15);
            const description = displayInvites.map(inv =>
                `\`${inv.code}\` - **${inv.uses}** uses - by ${inv.inviter?.tag || "Unknown"}`
            ).join("\n");

            const embed = new MessageEmbed()
                .setTitle(`server invites (${invites.size})`)
                .setDescription(description + (invites.size > 15 ? `\n\n*...and ${invites.size - 15} more.*` : ""));
            // No color set

            return message.reply({ embeds: [embed] });
        }

        // --- DELETE INVITE(S) ---
        if (sub === "delete") {
            const target = args[1];

            if (!target) {
                return message.reply("*please specify a code to delete, or use `all` to delete all invites.*");
            }

            // DELETE ALL
            if (target.toLowerCase() === "all" || target.toLowerCase() === "invites") {
                const confirmEmbed = new MessageEmbed()
                    .setTitle("delete all invites?")
                    .setDescription("*are you sure you want to delete **ALL** invites in this server? this cannot be undone.*");
                // No color set

                const row = new MessageActionRow().addComponents(
                    new MessageButton().setCustomId("invite_delete_all_confirm").setLabel("Confirm").setStyle("DANGER"),
                    new MessageButton().setCustomId("invite_delete_all_cancel").setLabel("Cancel").setStyle("SECONDARY")
                );

                const prompt = await message.reply({ embeds: [confirmEmbed], components: [row] });

                const filter = i => i.user.id === message.author.id && ["invite_delete_all_confirm", "invite_delete_all_cancel"].includes(i.customId);
                try {
                    const interaction = await prompt.awaitMessageComponent({ filter, time: 15000 });

                    if (interaction.customId === "invite_delete_all_cancel") {
                        return interaction.update({ content: "*cancelled.*", embeds: [], components: [] });
                    }

                    await interaction.update({ content: "*deleting all invites...*", embeds: [], components: [] });

                    const invites = await message.guild.invites.fetch();
                    let count = 0;
                    for (const invite of invites.values()) {
                        await invite.delete().catch(() => { });
                        count++;
                    }

                    return message.channel.send(`*successfully deleted **${count}** invites.*`);

                } catch (e) {
                    return prompt.edit({ content: "*timed out.*", embeds: [], components: [] }).catch(() => { });
                }
            }

            // DELETE SPECIFIC CODE
            try {
                const invite = await message.guild.invites.fetch(target).catch(() => null);
                if (!invite) return message.reply("*invite not found.*");

                await invite.delete();
                return message.reply(`*successfully deleted invite \`${target}\`.*`);
            } catch (e) {
                return message.reply("*failed to delete invite.*");
            }
        }

        // --- CHECK INFO ---
        // If arg is provided and not "list"/"delete", assume it's a code
        const inviteCode = rawArg; // Assuming first arg is the code
        try {
            // Fetch invite (force fetch to get updated info)
            const invite = await client.fetchInvite(inviteCode).catch(() => null);

            if (!invite) {
                return message.reply("*invalid invite code or invite expired.*");
            }

            // Check if guild exists (for partial invites)
            if (!invite.guild) {
                return message.reply("*invite does not belong to a server.*");
            }

            // Ensure it's for this guild (optional, but good for context)
            if (invite.guild.id !== message.guild.id) {
                return message.reply("*that invite is for a different server.*");
            }

            const embed = new MessageEmbed()
                .setTitle(`invite info: ${invite.code}`)
                .addFields(
                    { name: "```channel```", value: invite.channel ? `<#${invite.channel.id}>` : "`unknown`", inline: true },
                    { name: "```creator```", value: `\`${invite.inviter?.tag || "Unknown"}\``, inline: true },
                    { name: "```uses```", value: `\`${invite.uses || 0} / ${invite.maxUses || "∞"}\``, inline: true },
                    { name: "```expires?```", value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:R>` : "`never`", inline: true },
                    { name: "```created?```", value: invite.createdAt ? `<t:${Math.floor(invite.createdAt.getTime() / 1000)}:R>` : "`unknown`", inline: true }
                )
                .setThumbnail(invite.guild.iconURL({ dynamic: true }));

            return message.reply({ embeds: [embed] });

        } catch (e) {
            console.error(e);
            return message.reply(`*could not fetch invite info. error: ${e.message}*`);
        }
    }
};
