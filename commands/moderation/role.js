const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");

module.exports = {
    name: "role",
    async execute(client, message, args) {
        if (!message.member.permissions.has("ADMINISTRATOR") && message.author.id !== message.guild.ownerId) {
            return message.reply("*sorry, only administrators or the server owner can use this command.*");
        }

        const action = args[0]?.toLowerCase();
        const target = message.mentions.members.first() || message.guild.members.cache.get(args[1]);
        const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]?.replace(/[<@&>]/g, ""));

        if (!action || !["add", "remove"].includes(action)) {
            const embed = new MessageEmbed()
                .setTitle("role command")
                .setDescription("*add or remove roles from members.*")
                .addFields(
                    { name: "```usage```", value: "`,role add @user @role`\n`,role remove @user @role`", inline: false },
                    { name: "```examples```", value: "`,role add @yusuf @Member`\n`,role remove @yusuf @VIP`", inline: false }
                );
            return message.reply({ embeds: [embed] });
        }

        if (!target) {
            return message.reply("*please mention a valid user.*");
        }

        if (!role) {
            return message.reply("*please mention a valid role.*");
        }

        // Check if bot can manage this role
        if (role.position >= message.guild.me.roles.highest.position) {
            return message.reply("*i can't manage this role, it's higher than or equal to my highest role.*");
        }

        // Check if user can manage this role
        if (message.author.id !== message.guild.ownerId && role.position >= message.member.roles.highest.position) {
            return message.reply("*you can't manage this role, it's higher than or equal to your highest role.*");
        }

        const isAdding = action === "add";
        const hasRole = target.roles.cache.has(role.id);

        if (isAdding && hasRole) {
            return message.reply(`*${target.user.username} already has the ${role.name} role.*`);
        }

        if (!isAdding && !hasRole) {
            return message.reply(`*${target.user.username} doesn't have the ${role.name} role.*`);
        }

        // Confirmation embed
        const confirmEmbed = new MessageEmbed()
            .setTitle(`confirm role ${action}?`)
            .setDescription(`*are you sure you want to ${action} the **${role.name}** role ${isAdding ? "to" : "from"} **${target.user.username}**?*`);

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId("role_confirm")
                    .setLabel("Confirm")
                    .setStyle(isAdding ? "SUCCESS" : "DANGER"),
                new MessageButton()
                    .setCustomId("role_cancel")
                    .setLabel("Cancel")
                    .setStyle("SECONDARY")
            );

        const confirmMsg = await message.reply({ embeds: [confirmEmbed], components: [row] });

        const filter = (i) => i.user.id === message.author.id && ["role_confirm", "role_cancel"].includes(i.customId);

        try {
            const interaction = await confirmMsg.awaitMessageComponent({ filter, time: 30000 });

            if (interaction.customId === "role_confirm") {
                if (isAdding) {
                    await target.roles.add(role);
                } else {
                    await target.roles.remove(role);
                }

                const successEmbed = new MessageEmbed()
                    .setTitle(`role ${isAdding ? "added" : "removed"} successfully.`)
                    .setDescription(`*${isAdding ? "added" : "removed"} **${role.name}** ${isAdding ? "to" : "from"} **${target.user.username}**.*`);

                await interaction.update({ embeds: [successEmbed], components: [] });
            } else {
                const cancelEmbed = new MessageEmbed()
                    .setTitle("role action cancelled.")
                    .setDescription(`*no changes were made.*`);
                await interaction.update({ embeds: [cancelEmbed], components: [] });
            }
        } catch (error) {
            if (error.code === "INTERACTION_COLLECTOR_ERROR") {
                const timeoutEmbed = new MessageEmbed()
                    .setTitle("role action timed out.")
                    .setDescription("*no response received, action cancelled.*");
                await confirmMsg.edit({ embeds: [timeoutEmbed], components: [] });
            } else {
                console.error(error);
                message.reply("*sorry, couldn't modify the role.*");
            }
        }
    },
};
