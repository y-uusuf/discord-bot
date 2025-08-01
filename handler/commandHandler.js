const fs = require("fs");
const path = require("path");

module.exports = (client) => {
    const commandFiles = fs.readdirSync(path.join(__dirname, "../commands")).filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
        const command = require(`../commands/${file}`);
        if (command.name && typeof command.execute === "function") {
            client.commands.set(command.name, command);
            console.log(`Sucessfully loaded the '${command.name}' command.`);
        } else {
            console.warn(`[⚠️] Skipped invalid command file: ${file}`);
        }
    }
};
