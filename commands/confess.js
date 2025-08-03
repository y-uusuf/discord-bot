const { MessageEmbed, WebhookClient } = require("discord.js")
const { execute } = require("./ban")

module.exports = {
    name: 'confess',
    async execute(client, message, args, webhook) {

        let confession = args[0]

        if (!confession) return message.reply("*please, tell me what you'd like to confess to the server.*")

        let confessEmbed = new MessageEmbed()
        .setColor("DARK_BUT_NOT_BLACK")
        .setAuthor("a confession has been made.")
        .setDescription(`❝*${confession}*❞.`)
        .setTimestamp()

        confessionCh = new WebhookClient({
            id: "1400935245078986813",
            token: "ivYodPXt8F_h6q2GpAOiA9VylMp8ERYTpTwQUJz7eFZQE8l-Z_KHqwZUTtd6gYIuCD56"
        }).then(confessionCh.send({embeds: [confessEmbed]}))
    }
}