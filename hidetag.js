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

async function hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message) {
    try {
        // Sirf owner check - 923436259742
        const ownerNumber = config.owner + '@s.whatsapp.net';
        if (senderId !== ownerNumber) {
            return await sock.sendMessage(chatId, { text: '❌ Only owner can use .hidetag command.' }, { quoted: message });
        }

        const groupMetadata = await sock.groupMetadata(chatId).catch(() => null);
        if (!groupMetadata?.participants) {
            return await sock.sendMessage(chatId, { text: '❌ Group data nahi mil rahi. Bot group me hai?' });
        }

        const participants = groupMetadata.participants;
        // Sirf non-admin members tag honge
        const nonAdmins = participants.filter(p => !p.admin).slice(0, 256).map(p => p.id);

        if (nonAdmins.length === 0) {
            return await sock.sendMessage(chatId, { text: 'Group me non-admin member nahi hai.' });
        }

        if (replyMessage) {
            let content = {};
            if (replyMessage.imageMessage) {
                const filePath = await downloadMediaMessage(replyMessage.imageMessage, 'image');
                if (!filePath) return;
                content = { image: { url: filePath }, caption: messageText || replyMessage.imageMessage.caption || '', mentions: nonAdmins };
            } else if (replyMessage.videoMessage) {
                const filePath = await downloadMediaMessage(replyMessage.videoMessage, 'video');
                if (!filePath) return;
                content = { video: { url: filePath }, caption: messageText || replyMessage.videoMessage.caption || '', mentions: nonAdmins };
            } else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
                content = { text: replyMessage.conversation || replyMessage.extendedTextMessage.text, mentions: nonAdmins };
            } else if (replyMessage.documentMessage) {
                const filePath = await downloadMediaMessage(replyMessage.documentMessage, 'document');
                if (!filePath) return;
                content = { document: { url: filePath }, fileName: replyMessage.documentMessage.fileName, caption: messageText || '', mentions: nonAdmins };
            }

            if (Object.keys(content).length > 0) {
                await sock.sendMessage(chatId, content, { quoted: message });
                // Temp file delete
                if (content.image?.url) fs.unlinkSync(content.image.url);
                if (content.video?.url) fs.unlinkSync(content.video.url);
                if (content.document?.url) fs.unlinkSync(content.document.url);
            }
        } else {
            await sock.sendMessage(chatId, { 
                text: messageText || `🔕 Tagged ${nonAdmins.length} members (admins excluded)`, 
                mentions: nonAdmins 
            }, { quoted: message });
        }
    } catch (error) {
        console.error('Error in hidetag:', error);
        await sock.sendMessage(chatId, { text: 'Hidetag failed: ' + error.message });
    }
}

module.exports = hideTagCommand;