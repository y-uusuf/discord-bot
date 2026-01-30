const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const config = require("../../config.json");
const Blacklist = require("../../models/blacklist");

module.exports = {
    name: "blacklist",
    async execute(client, message, args) {
        
        if (message.author.id !== process.env.OWNER_ID) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: you are not authorized to use this command.`);
            return message.reply({ embeds: [embed] });
        }

        const action = args[0]?.toLowerCase();
        const targetId = args[1]?.replace(/[<@!>]/g, "");
        const reason = args.slice(2).join(" ") || "No reason provided";

        
        if (!action) {
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`🚫 <@${message.author.id}>: manage blacklisted users.\n\n**usage:** \`,blacklist <add/remove/check/list> [user] [reason]\`\n**example:** \`,blacklist add @user spamming\``);
            return message.reply({ embeds: [embed] });
        }

        
        if (action === "list") {
            const blacklisted = await Blacklist.find({});
            if (blacklisted.length === 0) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`🚫 <@${message.author.id}>: no users are currently blacklisted.`);
                return message.reply({ embeds: [embed] });
            }

            const list = blacklisted.map(b => `• <@${b.userId}>: ${b.reason}`).join("\n");
            const embed = new MessageEmbed()
                .setColor(config.embedColor).setDescription(`🚫 <@${message.author.id}>: blacklisted users:\n\n${list}`);
            return message.reply({ embeds: [embed] });
        }

        
        if (action === "check") {
            if (!targetId) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please provide a user to check.`);
                return message.reply({ embeds: [embed] });
            }

            const entry = await Blacklist.findOne({ userId: targetId });
            if (entry) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`🚫 <@${message.author.id}>: <@${targetId}> is blacklisted.\n\n**reason:** ${entry.reason}`);
                return message.reply({ embeds: [embed] });
            } else {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`✅ <@${message.author.id}>: <@${targetId}> is not blacklisted.`);
                return message.reply({ embeds: [embed] });
            }
        }

        
        if (action === "add") {
            if (!targetId) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please provide a user to blacklist.`);
                return message.reply({ embeds: [embed] });
            }

            const existing = await Blacklist.findOne({ userId: targetId });
            if (existing) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: <@${targetId}> is already blacklisted.`);
                return message.reply({ embeds: [embed] });
            }

            
            const embed = new MessageEmbed()
                .setColor("RED")
                .setDescription(`⚠️ <@${message.author.id}>: are you sure you want to blacklist <@${targetId}>?\n\n**reason:** ${reason}`);

            const row = new MessageActionRow().addComponents(
                new MessageButton()
                    .setCustomId("confirm_blacklist")
                    .setLabel("confirm.")
                    .setStyle("DANGER")
                    .setEmoji("🚫")
            );

            const reply = await message.reply({ embeds: [embed], components: [row] });

            const filter = (i) => i.customId === "confirm_blacklist" && i.user.id === message.author.id;
            const collector = reply.createMessageComponentCollector({ filter, time: 15000, max: 1 });

            collector.on("collect", async (i) => {
                await i.deferUpdate();

                await Blacklist.create({
                    userId: targetId,
                    reason: reason,
                    blacklistedBy: message.author.id
                });

                const successEmbed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`🚫 <@${message.author.id}>: <@${targetId}> has been blacklisted.`);
                await i.editReply({ embeds: [successEmbed], components: [] });
            });

            collector.on("end", (collected) => {
                if (collected.size === 0) {
                    reply.edit({ components: [] }).catch(() => { });
                }
            });

            return;
        }

        
        if (action === "remove") {
            if (!targetId) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: please provide a user to unblacklist.`);
                return message.reply({ embeds: [embed] });
            }

            const deleted = await Blacklist.findOneAndDelete({ userId: targetId });
            if (deleted) {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`✅ <@${message.author.id}>: <@${targetId}> has been removed from the blacklist.`);
                return message.reply({ embeds: [embed] });
            } else {
                const embed = new MessageEmbed()
                    .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: <@${targetId}> is not blacklisted.`);
                return message.reply({ embeds: [embed] });
            }
        }

        
        const embed = new MessageEmbed()
            .setColor(config.embedColor).setDescription(`❌ <@${message.author.id}>: unknown action. use \`add\`, \`remove\`, \`check\`, or \`list\`.`);
        return message.reply({ embeds: [embed] });
    }
};
