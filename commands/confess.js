const { MessageEmbed, WebhookClient } = require("discord.js");

require("dotenv").config()

module.exports = {
    name: 'confess',
    async execute(client, message, args, webhook) {

        if (message.guild) return;

        let confession = args.join(' ');
        
        if (!confession || confession.trim() === '') {
            return message.reply("*please, tell me what you'd like to confess to the server.*\n*Example: `" + (message.guild ? "," : ",") + "confess I have a secret crush on someone`*");
        }

        // Create the confession embed
        let confessEmbed = new MessageEmbed()
            .setColor("DARK_BUT_NOT_BLACK")
            .setAuthor({ name: "someone has made a confession." })
            .setDescription(`*"__${confession}__"*`)
            .setFooter({ text: "sent anonymously via DMs // do the same with \",confess\"." })
            .setTimestamp();

        // Create webhook client for confessions (separate from the logging webhook)
        const confessionWebhook = new WebhookClient({
            id: "1401686426453672121",
            token: process.env.CONFESSION_WEBHOOK_TOKEN
        });

        try {
            // Send the confession to the confessions channel
            await confessionWebhook.send({ 
                embeds: [confessEmbed],
                username: "confessions >//<",
                avatarURL: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/15/ae/ba/15aeba68-dd90-d9bc-6189-58a7ad8596e5/artwork.jpg/600x600bf-60.jpg" // Optional: custom avatar
            });
            
            // Confirm to the user in DM
            await message.reply("*your confession has been sent anonymously to the server!* \n> `no one will know it was you.`");
            
        } catch (error) {
            console.error("Error sending confession:", error);
            await message.reply("*sorry, something went wrong while sending your confession. please try again later.*");
        }
}
};