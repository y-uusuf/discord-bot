const { MessageEmbed } = require('discord.js');

module.exports = {
    name: 'strip',
    async execute(client, message, args) {
        try {

            if (!message.member.permissions.has("MANAGE_ROLES")) {
                return message.reply("*you don't have permission to strip image perms from members.*");
            }

            const targetUser = message.mentions.members.first() || message.member;

            // Get the role by ID
            const role = message.guild.roles.cache.get('896837164048994334');

            if (!role) {
                const errorEmbed = new MessageEmbed()
                    .setDescription('*sorry, couldn\'t find the image perms role.*')
                    .setColor('RED');
                return message.reply({ embeds: [errorEmbed] });
            }

            // Check if user does NOT have the role
            if (!targetUser.roles.cache.has(role.id)) {
                const noRoleEmbed = new MessageEmbed()
                    .setDescription(`**${targetUser.user.username}** doesn't have image perms.`)
                    .setColor('YELLOW');
                return message.reply({ embeds: [noRoleEmbed] });
            }

            // Remove the role
            await targetUser.roles.remove(role);

            // Success embed
            const successEmbed = new MessageEmbed()
                .setDescription(`**perms removed** from **${targetUser.user.username}**.`)
                .setColor('ORANGE')
                .setFooter({ text: `${targetUser.username} no longer has image perms.`, iconURL: targetUser.user.displayAvatarURL({ dynamic: true })});

            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error in strip command:', error);
            message.reply("*sorry, i couldn't remove the role.*");
        }
    }
};
