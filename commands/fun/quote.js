const { MessageAttachment } = require('discord.js');
const Canvas = require('canvas');

module.exports = {
    name: "quote",
    description: "Quote a message as an image",
    category: "fun",
    async execute(client, message, args) {
        let targetMessageContent = "";
        let targetUser = null;
        let targetMember = null;

        // Determine target
        if (args.length > 0) {
            targetMessageContent = args.join(" ");
            targetUser = message.author;
            targetMember = message.member;
        } else if (message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
            if (!repliedMessage.content) {
                return message.reply("❌ The message must have text content to quote!");
            }
            targetMessageContent = repliedMessage.content;
            targetUser = repliedMessage.author;
            targetMember = repliedMessage.member;
        } else {
            return message.reply("❌ Reply to a message or provide text to quote yourself!");
        }

        try {
            await message.react("💬").catch(() => { });

            // New Dimensions: 1200x630
            const canvas = Canvas.createCanvas(1200, 630);
            const ctx = canvas.getContext('2d');

            // 1. Black background
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Avatar (Left side)
            // Left section is 0-700. Avatar should be prominent.
            const avatarSize = 650;
            const avatarURL = targetUser.displayAvatarURL({ format: 'png', size: 1024 });
            const avatar = await Canvas.loadImage(avatarURL);

            ctx.drawImage(avatar, 0, -10, avatarSize, avatarSize);

            // Grayscale Filter
            const imgData = ctx.getImageData(0, -10, avatarSize, avatarSize);
            const data = imgData.data;
            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = avg;
                data[i + 1] = avg;
                data[i + 2] = avg;
            }
            ctx.putImageData(imgData, 0, -10);

            // Gradient Fade
            const gradient = ctx.createLinearGradient(0, 0, 700, 0);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
            gradient.addColorStop(0.8, 'rgba(0, 0, 0, 0.95)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 701, 630);

            // Ensure right side is fully black for text
            ctx.fillStyle = '#000000';
            ctx.fillRect(699, 0, 501, 630);

            // 3. Text Configuration
            ctx.fillStyle = '#E0E0E0';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textCenterX = 950;
            const maxWidth = 450;

            const quoteText = `"${targetMessageContent}"`;

            // Iterative shrinking with aggressive wrapping
            let fontSize = 80;
            let lines = [];

            const getWidth = (txt) => ctx.measureText(txt).width;

            while (fontSize > 15) {
                ctx.font = `italic ${fontSize}px "Arial"`;
                lines = [];
                let line = '';

                const rawWords = quoteText.split(' ');
                let words = [];

                for (const w of rawWords) {
                    if (getWidth(w) > maxWidth) {
                        let currentSubWord = "";
                        for (const char of w) {
                            if (getWidth(currentSubWord + char) > maxWidth) {
                                words.push(currentSubWord);
                                currentSubWord = char;
                            } else {
                                currentSubWord += char;
                            }
                        }
                        if (currentSubWord) words.push(currentSubWord);
                    } else {
                        words.push(w);
                    }
                }

                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    if (getWidth(testLine.trim()) > maxWidth && n > 0) {
                        lines.push(line.trim());
                        line = words[n] + ' ';
                    } else {
                        line = testLine;
                    }
                }
                lines.push(line.trim());

                const lineHeight = fontSize * 1.2;
                const totalHeight = lines.length * lineHeight;

                if (totalHeight < 400 && lines.every(l => getWidth(l) <= maxWidth + 10)) {
                    break;
                }
                fontSize -= 2;
            }

            // Draw Quote
            const lineHeight = fontSize * 1.2;
            const authorHeight = 40;
            const userHeight = 30;
            const spacing = 40;
            const totalBlockHeight = (lines.length * lineHeight) + spacing + authorHeight + 5 + userHeight;

            const startY = (630 - totalBlockHeight) / 2;

            for (let i = 0; i < lines.length; i++) {
                ctx.fillText(lines[i], textCenterX, startY + (i * lineHeight) + fontSize);
            }

            const attributionY = startY + (lines.length * lineHeight) + spacing + 30;

            // Draw Attribution
            ctx.font = 'bold 30px "Arial"';
            ctx.fillStyle = '#C0C0C0';
            const displayName = targetMember?.displayName || targetUser.username;

            // Case sensitive display name
            let finalName = `- ${displayName}`;

            if (ctx.measureText(finalName).width > maxWidth) {
                while (ctx.measureText(finalName + "...").width > maxWidth && finalName.length > 3) {
                    finalName = finalName.slice(0, -1);
                }
                finalName += "...";
            }
            ctx.fillText(finalName, textCenterX, attributionY);

            // Draw @username
            ctx.font = '24px "Arial"';
            ctx.fillStyle = 'rgba(128, 128, 128, 0.7)';
            ctx.fillText(`@${targetUser.username}`, textCenterX, attributionY + 35);

            // Send attachment
            const attachment = new MessageAttachment(canvas.toBuffer(), 'quote.png');
            await message.channel.send({ files: [attachment] });

        } catch (error) {
            console.error(error);
            message.reply("❌ Something went wrong while generating the quote.");
        }
    }
};
