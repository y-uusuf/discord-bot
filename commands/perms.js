const { MessageEmbed } = require('discord.js');

module.exports = {
    name: 'perms',
    async execute(client, message, args) {
        try {

            if (!message.member.permissions.has("MANAGE_ROLES")) {
                return message.reply("*you don't have permission to add image perms to members.*");
            }

            const targetUser = message.mentions.members.first() || message.member;
            
            // Get the role by ID
            const role = message.guild.roles.cache.get('896837164048994334');
            
            if (!role) {
                const errorEmbed = new MessageEmbed()
                    .setDescription('*sorry, couldn\'t find the image perms role.*')
                    .setColor('RED');
                return message.replt({ embeds: [errorEmbed] });
            }

            // Check if user already has the role
            if (targetUser.roles.cache.has(role.id)) {
                const alreadyHasEmbed = new MessageEmbed()
                    .setDescription(`**${targetUser.user.username}** already has image perms.`)
                    .setColor('YELLOW');
                return message.reply({ embeds: [alreadyHasEmbed] });
            }

            // Add the role
            await targetUser.roles.add(role);

            // Success embed
            const successEmbed = new MessageEmbed()
                .setDescription(`**perms added** for **${targetUser.user.username}**.`)
                .setColor('GREEN')
                .setFooter({ text: `${targetUser.username} has image perms now.`, iconURL: targetUser.user.displayAvatarURL({ dynamic: true })});

            message.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error in perms command:', error);
            message.reply("*sorry, i couldn't add the role.*")
        }
    }
};