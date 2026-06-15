const { Client, GatewayIntentBits } = require('discord.js');
const https = require('https');
const fs = require('fs');

// === CONFIGURATION ===
const TOKEN = process.env.TOKEN; // Set di Railway Variables
const TARGET_CHANNEL_ID = '1512793386199945437'; 
const HISTORY_FILE = '/tmp/checked_history.txt'; // /tmp agar bisa ditulis di Railway

const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
const CONCURRENT_REQUESTS = 30; 
const DELAY_BETWEEN_BATCH = 300; 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

let isRunning = false;
let queue = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function saveToHistory(username) {
    fs.appendFileSync(HISTORY_FILE, username + '\n', 'utf8');
}

function loadHistory() {
    if (!fs.existsSync(HISTORY_FILE)) {
        return new Set();
    }
    const fileContent = fs.readFileSync(HISTORY_FILE, 'utf8');
    return new Set(fileContent.split('\n').map(name => name.trim()).filter(Boolean));
}

function checkUsername(username, channel) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'discord.com',
            port: 443,
            path: `/users/${username}`,
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };

        const req = https.request(options, (res) => {
            if (res.statusCode === 404) {
                console.log(`[FOUND] ${username} KOSONG!`);
                channel.send(`⚠️ **JACKPOT! USERNAME KOSONG NEGO HALAL!** ⚠️\n> Username: \`${username}\` beneran kosong! Buruan ganti sekarang! @everyone`);
            } else if (res.statusCode === 200) {
                console.log(`[TAKEN] ${username}`);
                saveToHistory(username);
            }
            resolve();
        });
        req.on('error', () => resolve());
        req.end();
    });
}

client.once('clientReady', () => {
    console.log(`=== Bot ${client.user.tag} Sudah Online! ===`);
    console.log("Ketik !start di server Discord untuk memulai pencarian.");
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!start') {
        if (isRunning) {
            isRunning = false;
            queue = [];
            await sleep(500);
        }
        
        isRunning = true;
        
        const checkedHistory = loadHistory();
        message.reply(`🔄 **Memuat database riwayat...** Sudah ada \`${checkedHistory.size}\` nama yang pernah dicatat & dilewati.`);

        queue = [];
        let totalGenerated = 0;
        
        for (let i = 0; i < chars.length; i++) {
            for (let j = 0; j < chars.length; j++) {
                for (let k = 0; k < chars.length; k++) {
                    for (let l = 0; l < chars.length; l++) {
                        const username = chars[i] + chars[j] + chars[k] + chars[l];
                        totalGenerated++;
                        if (!checkedHistory.has(username)) {
                            queue.push(username);
                        }
                    }
                }
            }
        }
        
        if (queue.length === 0) {
            isRunning = false;
            return message.channel.send('🏁 Wah gila, semua kombinasi 4 karakter sudah habis kamu cek semua!');
        }

        queue = shuffle(queue);
        message.channel.send(`🚀 **Pencarian dilanjutkan!** Memeriksa \`${queue.length}\` sisa kombinasi dari total ${totalGenerated} variasi secara acak.`);

        const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID) || message.channel;

        while (queue.length > 0 && isRunning) {
            const batch = queue.splice(0, CONCURRENT_REQUESTS);
            await Promise.all(batch.map(username => checkUsername(username, targetChannel)));
            await sleep(DELAY_BETWEEN_BATCH);
        }
        
        if (!isRunning) {
            targetChannel.send('🛑 Pencarian dihentikan. Riwayat sudah tersimpan!');
        } else {
            targetChannel.send('🏁 Semua kombinasi selesai dicek!');
            isRunning = false;
        }
    }

    if (message.content === '!stop') {
        if (!isRunning) return message.reply('Bot-nya emang lagi tidur, gak usah di-stop.');
        isRunning = false;
        message.reply('Siaapp, sistem ngerem total!');
    }
});

client.login(TOKEN);