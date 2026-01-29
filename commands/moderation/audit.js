const { MessageEmbed } = require("discord.js");

module.exports = {
    name: "audit",
    async execute(client, message, args) {
        if (!message.member.permissions.has("VIEW_AUDIT_LOG")) {
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: you are missing **View Audit Log** permission(s) to run this command`);
            return message.reply({ embeds: [embed] });
        }

        try {
            const auditLogs = await message.guild.fetchAuditLogs({ limit: 10 });
            const entries = auditLogs.entries;

            if (!entries || entries.size === 0) {
                const embed = new MessageEmbed()
                    .setDescription(`📋 <@${message.author.id}>: no audit logs found`);
                return message.reply({ embeds: [embed] });
            }

            const logList = entries.map(entry => {
                const action = entry.action.replace("ALL", "").replace(/_/g, " ").toLowerCase();
                const user = entry.executor;
                const time = Math.floor(entry.createdAt.getTime() / 1000);

                return {
                    name: `\`\`\`${action}\`\`\``,
                    value: `by ${user} <t:${time}:R>`,
                    inline: false
                };
            });

            const embed = new MessageEmbed()
                .setDescription(`📋 <@${message.author.id}>: recent audit logs (last 10)`)
                .addFields(...logList);

            return message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            const embed = new MessageEmbed()
                .setDescription(`❌ <@${message.author.id}>: failed to fetch audit logs`);
            return message.reply({ embeds: [embed] });
        }
    },
};
