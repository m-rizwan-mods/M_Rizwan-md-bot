const config = require('../config');

async function tagAllCommand(sock, chatId, senderId, message) {
    try {
        // Sirf owner check - 03436259742
        const ownerNumber = config.owner + '@s.whatsapp.net';
        if (senderId !== ownerNumber) {
            await sock.sendMessage(chatId, { text: '❌ Only owner can use .tagall command.' }, { quoted: message });
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { text: 'No participants found in the group.' });
            return;
        }

        let messageText = '🔊 *Attention Everyone:*\n\n';
        participants.forEach(participant => {
            messageText += `@${participant.id.split('@')[0]}\n`;
        });

        await sock.sendMessage(chatId, {
            text: messageText,
            mentions: participants.map(p => p.id)
        }, { quoted: message });

    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to tag all members.' });
    }
}

module.exports = tagAllCommand;