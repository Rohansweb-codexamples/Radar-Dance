const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

/** * FREQUENCY CONFIGURATION
 * Replace this URL with your preferred radio stream (mp3, aac, etc.)
 */
const EXTERNAL_RADIO_URL = 'https://radar-dance-radio.onrender.com/'; 

// Global state for the broadcast metadata
let broadcastStatus = {
    nowPlaying: "SEARCHING FOR FREQUENCIES...",
    isEmergency: false,
    activeListeners: 0
};

// --- LISTENER UI (Root Route '/') ---
const listenerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RADAR // LIVE SIGNAL</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #05070a; color: #e0e0e0; overflow: hidden; font-family: 'Courier New', monospace; }
        .radar-bg { background: radial-gradient(circle at center, #1a103d 0%, #05070a 80%); }
        
        .sweep {
            position: absolute; top: 50%; left: 50%; width: 1000px; height: 1000px;
            background: conic-gradient(from 0deg, rgba(138, 43, 226, 0.15) 0%, transparent 15%);
            border-radius: 50%; transform-origin: center; animation: rotate 5s linear infinite;
            margin-top: -500px; margin-left: -500px; pointer-events: none;
        }

        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .scanline {
            width: 100%; height: 2px; background: rgba(138, 43, 226, 0.05);
            position: absolute; z-index: 20; pointer-events: none;
            animation: scanline 8s linear infinite;
        }
        @keyframes scanline { 0% { top: -5%; } 100% { top: 105%; } }

        .glow { text-shadow: 0 0 10px #8a2be2, 0 0 20px #4b0082; }
        
        .interference { animation: shake 0.2s infinite; }
        @keyframes shake {
            0% { transform: translate(1px, 1px) rotate(0deg); }
            25% { transform: translate(-1px, -2px) rotate(-1deg); }
            50% { transform: translate(-3px, 0px) rotate(1deg); }
            75% { transform: translate(3px, 2px) rotate(0deg); }
            100% { transform: translate(1px, -1px) rotate(-1deg); }
        }
    </style>
</head>
<body class="radar-bg h-screen flex items-center justify-center relative">
    <div class="scanline"></div>
    <div class="sweep"></div>

    <div id="main-container" class="relative z-10 text-center bg-black/40 backdrop-blur-2xl p-10 rounded-2xl border border-purple-500/20 shadow-2xl w-[380px]">
        <div class="mb-6">
            <div class="flex justify-center mb-4">
                <div class="w-24 h-1 bg-purple-900/50 rounded-full overflow-hidden">
                    <div id="signal-bar" class="h-full bg-purple-500 transition-all duration-700" style="width: 30%"></div>
                </div>
            </div>
            <h1 class="text-4xl font-black tracking-[0.2em] glow text-purple-500 italic">RADAR</h1>
            <div id="status" class="text-[10px] text-purple-400 mt-3 tracking-widest uppercase opacity-80">Syncing...</div>
        </div>
        
        <div class="relative group cursor-pointer inline-block" id="playBtn">
            <div class="absolute -inset-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur opacity-20 group-hover:opacity-60 transition duration-1000"></div>
            <div class="relative w-24 h-24 bg-[#0a0a0f] rounded-full border border-purple-500/50 flex items-center justify-center shadow-inner">
                <svg id="playIcon" class="w-10 h-10 fill-purple-500 translate-x-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
        </div>

        <div class="mt-10 flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest">
            <span class="lcd-text">VOL: <span id="vol-display">70</span>%</span>
            <input type="range" id="vol" class="w-32 accent-purple-600 bg-gray-800" min="0" max="1" step="0.01" value="0.7">
        </div>
        
        <div id="alert" class="hidden mt-6 p-2 border border-red-900/50 bg-red-950/20 text-red-500 text-[10px] font-bold">
            SIGNAL INTERFERENCE DETECTED
        </div>
    </div>

    <audio id="audio" crossOrigin="anonymous" src="/stream"></audio>

    <script>
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const statusText = document.getElementById('status');
        const signalBar = document.getElementById('signal-bar');
        const alertEl = document.getElementById('alert');
        const container = document.getElementById('main-container');
        
        async function updateStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                statusText.innerText = data.nowPlaying;
                
                // Visual Signal Strength Logic
                signalBar.style.width = Math.floor(Math.random() * 40 + 60) + '%';
                
                if (data.isEmergency) {
                    alertEl.classList.remove('hidden');
                    container.classList.add('interference');
                } else {
                    alertEl.classList.add('hidden');
                    container.classList.remove('interference');
                }
            } catch(e) { console.error("Sync error"); }
        }

        setInterval(updateStatus, 3000);

        playBtn.onclick = () => {
            if (audio.paused) {
                audio.play();
                document.getElementById('playIcon').innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
                document.getElementById('playIcon').classList.remove('translate-x-1');
            } else {
                audio.pause();
                document.getElementById('playIcon').innerHTML = '<path d="M8 5v14l11-7z"/>';
                document.getElementById('playIcon').classList.add('translate-x-1');
            }
        };

        document.getElementById('vol').oninput = (e) => {
            audio.volume = e.target.value;
            document.getElementById('vol-display').innerText = Math.round(e.target.value * 100);
        };
    </script>
</body>
</html>
`;

// --- ADMIN UI (Route '/admin') ---
const adminHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>RADAR // COMMAND CENTER</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#05070a] text-purple-400 p-6 md:p-12 font-mono">
    <div class="max-w-xl mx-auto border border-purple-500/30 p-8 rounded-lg bg-black/40 shadow-2xl">
        <div class="flex items-center justify-between mb-8 border-b border-purple-900 pb-4">
            <h1 class="text-xl tracking-[0.3em] font-bold italic">BROADCAST COMMAND</h1>
            <div class="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_#22c55e]"></div>
        </div>
        
        <div class="space-y-6">
            <div>
                <label class="block mb-2 text-[10px] uppercase text-gray-500 tracking-widest">Metadata Transmission</label>
                <input id="metaInput" type="text" class="w-full bg-[#0a0a0f] border border-purple-900/50 p-4 text-white outline-none focus:border-purple-500 transition-all" placeholder="ENTER TRACK OR MESSAGE...">
            </div>
            
            <div class="flex items-center p-4 bg-purple-900/10 rounded border border-purple-900/20">
                <input type="checkbox" id="emergency" class="w-5 h-5 accent-purple-600 rounded cursor-pointer">
                <label for="emergency" class="ml-3 text-xs uppercase cursor-pointer select-none">Trigger Signal Interference (Screen Shake)</label>
            </div>

            <button onclick="transmit()" class="w-full bg-purple-700 text-white font-bold p-4 hover:bg-purple-500 transition-all uppercase tracking-widest shadow-lg">
                Push to Frequencies
            </div>
        </div>
        
        <div class="mt-10 text-[9px] text-gray-600 flex justify-between uppercase">
            <span>Terminal: RX-9000</span>
            <span>Status: Secure</span>
        </div>
    </div>

    <script>
        function transmit() {
            const msg = document.getElementById('metaInput').value;
            const isEm = document.getElementById('emergency').checked;
            fetch('/api/update?msg=' + encodeURIComponent(msg) + '&em=' + isEm)
                .then(() => {
                    const btn = document.querySelector('button');
                    const oldText = btn.innerText;
                    btn.innerText = "TRANSMITTED";
                    setTimeout(() => btn.innerText = oldText, 2000);
                });
        }
    </script>
</body>
</html>
`;

// --- EXPRESS ROUTES ---

// Main Pages
app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));

// Data API
app.get('/api/status', (req, res) => res.json(broadcastStatus));
app.get('/api/update', (req, res) => {
    broadcastStatus.nowPlaying = req.query.msg || "RADAR LIVE TRANSMISSION";
    broadcastStatus.isEmergency = req.query.em === 'true';
    res.json({ success: true });
});

// Audio Stream Proxy (Crucial for bypassing CORS and Mixed Content issues)
app.get('/stream', async (req, res) => {
    try {
        const response = await axios({
            method: 'get',
            url: EXTERNAL_RADIO_URL,
            responseType: 'stream',
            timeout: 10000
        });

        res.set({
            'Content-Type': response.headers['content-type'] || 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });

        response.data.pipe(res);
    } catch (error) {
        console.error('Stream Proxy Error:', error.message);
        res.status(500).send('Radio Signal Lost');
    }
});

app.listen(PORT, () => {
    console.log(`\n📡 RADAR STATION ONLINE`);
    console.log(`Listener: http://localhost:${PORT}`);
    console.log(`Admin:    http://localhost:${PORT}/admin\n`);
});