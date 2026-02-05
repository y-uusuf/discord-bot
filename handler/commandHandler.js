const fs = require("fs");
const path = require("path");

module.exports = (client) => {
    const loadedCommands = [];
    const commandsPath = path.join(__dirname, "../commands");


    const readCommands = (dir) => {
        const files = fs.readdirSync(dir, { withFileTypes: true });

        for (const file of files) {
            if (file.isDirectory()) {
                readCommands(path.join(dir, file.name));
            } else if (file.name.endsWith(".js")) {
                const command = require(path.join(dir, file.name));
                if (command.name && typeof command.execute === "function") {
                    const category = path.relative(commandsPath, dir).split(path.sep)[0];
                    if (category) command.category = category;

                    client.commands.set(command.name, command);
                    loadedCommands.push(command.name);


                    if (command.aliases && Array.isArray(command.aliases)) {
                        for (const alias of command.aliases) {
                            client.commands.set(alias, command);
                        }
                    }
                } else {
                    console.warn(`[⚠️] Skipped invalid command file: ${file.name}`);
                }
            }
        }
    };

    if (fs.existsSync(commandsPath)) {
        readCommands(commandsPath);
    }

    return loadedCommands;
};
