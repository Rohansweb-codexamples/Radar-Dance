const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Configurable Radio Stream
const EXTERNAL_RADIO_URL = 'http://icecast.radiofrance.fr/fip-midfi.mp3'; 

// Shared state for the broadcast status
let broadcastStatus = {
    nowPlaying: "INITIALIZING SIGNAL...",
    listeners: 0
};

// --- LISTENER UI (Main Route) ---
const listenerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RADAR // LIVE</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #05070a; color: #e0e0e0; overflow: hidden; font-family: monospace; }
        .radar-bg { background: radial-gradient(circle at center, #1a103d 0%, #05070a 70%); }
        .sweep {
            position: absolute; top: 50%; left: 50%; width: 800px; height: 800px;
            background: conic-gradient(from 0deg, rgba(138, 43, 226, 0.2) 0%, transparent 20%);
            border-radius: 50%; transform-origin: center; animation: rotate 4s linear infinite;
            margin-top: -400px; margin-left: -400px;
        }
        @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .glow { text-shadow: 0 0 15px #8a2be2; }
    </style>
</head>
<body class="radar-bg h-screen flex items-center justify-center relative">
    <div class="sweep"></div>
    <div class="relative z-10 text-center bg-black/60 backdrop-blur-xl p-12 rounded-full border border-purple-500/30 shadow-[0_0_50px_rgba(138,43,226,0.2)] w-[350px] h-[350px] flex flex-col justify-center">
        <h1 class="text-4xl font-black tracking-tighter glow text-purple-500 mb-2 italic">RADAR</h1>
        <div id="status" class="text-[10px] text-purple-400 mb-4 tracking-[0.3em]">WAITING FOR SIGNAL...</div>
        
        <button id="playBtn" class="mx-auto w-20 h-20 rounded-full border-2 border-purple-500 flex items-center justify-center hover:bg-purple-500 hover:shadow-[0_0_20px_#8a2be2] transition-all group">
            <svg id="playIcon" class="w-8 h-8 fill-purple-500 group-hover:fill-white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </button>

        <div class="mt-6">
            <input type="range" id="vol" class="w-24 accent-purple-500" min="0" max="1" step="0.01" value="0.7">
        </div>
    </div>

    <audio id="audio" crossOrigin="anonymous" src="/stream"></audio>

    <script>
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const status = document.getElementById('status');
        
        setInterval(async () => {
            const res = await fetch('/api/status');
            const data = await res.json();
            status.innerText = data.nowPlaying;
        }, 3000);

        playBtn.onclick = () => {
            if (audio.paused) {
                audio.play();
                document.getElementById('playIcon').innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            } else {
                audio.pause();
                document.getElementById('playIcon').innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        };
        document.getElementById('vol').oninput = (e) => audio.volume = e.target.value;
    </script>
</body>
</html>
`;

// --- ADMIN UI (/admin Route) ---
const adminHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>RADAR // COMMAND</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-purple-400 p-10 font-bold">
    <div class="max-w-md mx-auto border-2 border-purple-500 p-8 rounded-lg shadow-[0_0_20px_purple]">
        <h1 class="text-2xl mb-6 tracking-widest">BROADCAST CONTROL</h1>
        <label class="block mb-2 text-xs uppercase">Current Metadata</label>
        <input id="metaInput" type="text" class="w-full bg-black border border-purple-900 p-3 mb-4 text-white focus:outline-none focus:border-purple-400" placeholder="e.g. LO-FI BEATS TO RELAX TO">
        <button onclick="update()" class="w-full bg-purple-600 text-white p-3 hover:bg-purple-400 transition-colors">PUSH TO RADAR</button>
        <div class="mt-6 text-[10px] text-slate-600 italic">SECURE CONNECTION ESTABLISHED</div>
    </div>
    <script>
        function update() {
            const val = document.getElementById('metaInput').value;
            fetch('/api/update?msg=' + encodeURIComponent(val));
        }
    </script>
</body>
</html>
`;

// Routes
app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));

// API for real-time updates
app.get('/api/status', (req, res) => res.json(broadcastStatus));
app.get('/api/update', (req, res) => {
    broadcastStatus.nowPlaying = req.query.msg || "RADAR LIVE";
    res.send("Updated");
});

// Audio Stream Proxy
app.get('/stream', async (req, res) => {
    try {
        const response = await axios({ method: 'get', url: EXTERNAL_RADIO_URL, responseType: 'stream' });
        res.set({ 'Content-Type': response.headers['content-type'], 'Transfer-Encoding': 'chunked' });
        response.data.pipe(res);
    } catch (e) {
        res.status(500).send("Signal Lost");
    }
});

app.listen(PORT, () => console.log('Radar active on port ' + PORT));