const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const config = require('../config');

async function downloadMediaMessage(message, mediaType) {
    try {
        const stream = await downloadContentFromMessage(message, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        const tempDir = path.join(__dirname, '../temp/');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `${Date.now()}.${mediaType}`);
        fs.writeFileSync(filePath, buffer);
        return filePath;
    } catch (e) {
        console.error('Download error:', e);
        return null;
    }
}

async function tagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    try {
        // Sirf owner check - 923436259742
        const ownerNumber = config.owner + '@s.whatsapp.net';
        if (senderId !== ownerNumber) {
            return await sock.sendMessage(chatId, { text: '❌ Only owner can use .tag command.' }, { quoted: message });
        }

        const groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
        if (!groupMetadata?.participants) {
            return await sock.sendMessage(chatId, { text: '❌ Group data nahi mil rahi. Bot group me hai?' });
        }

        const participants = groupMetadata.participants;
        // WhatsApp limit 256 mentions
        const mentionedJidList = participants.slice(0, 256).map(p => p.id);

        if (replyMessage) {
            let messageContent = {};

            // Handle image messages
            if (replyMessage.imageMessage) {
                const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
                if (!filePath) return await sock.sendMessage(chatId, { text: 'Image download failed' });
                messageContent = {
                    image: { url: filePath },
                    caption: messageText || replyMessage.imageMessage.caption || '',
                    mentions: mentionedJidList
                };
            }
            // Handle video messages
            else if (replyMessage.videoMessage) {
                const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
                if (!filePath) return await sock.sendMessage(chatId, { text: 'Video download failed' });
                messageContent = {
                    video: { url: filePath },
                    caption: messageText || replyMessage.videoMessage.caption || '',
                    mentions: mentionedJidList
                };
            }
            // Handle text messages
            else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
                messageContent = {
                    text: replyMessage.conversation || replyMessage.extendedTextMessage.text,
                    mentions: mentionedJidList
                };
            }
            // Handle document messages
            else if (replyMessage.documentMessage) {
                const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
                if (!filePath) return await sock.sendMessage(chatId, { text: 'Document download failed' });
                messageContent = {
                    document: { url: filePath },
                    fileName: replyMessage.documentMessage.fileName,
                    caption: messageText || '',
                    mentions: mentionedJidList
                };
            }

            if (Object.keys(messageContent).length > 0) {
                await sock.sendMessage(chatId, messageContent, { quoted: message });
                // Temp file delete kar do
                if (messageContent.image?.url) fs.unlinkSync(messageContent.image.url);
                if (messageContent.video?.url) fs.unlinkSync(messageContent.video.url);
                if (messageContent.document?.url) fs.unlinkSync(messageContent.document.url);
            }
        } else {
            await sock.sendMessage(chatId, {
                text: messageText || `🔊 Tagged ${mentionedJidList.length} members`,
                mentions: mentionedJidList
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in tag command:', error);
        await sock.sendMessage(chatId, { text: 'Tag failed. Error: ' + error.message });
    }
}

module.exports = tagCommand;