const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
const APP_URL = process.env.RENDER_EXTERNAL_URL || `https://radar-dance-radio.onrender.com/`;

// Setup directories
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// HIGH-SPEED STORAGE CONFIG
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, Date.now() + '-' + safeName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024, files: 100 } // Support up to 500MB per file
});

app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(uploadDir));

// --- SMART KEEP-ALIVE (ANTI-SLEEP) ---
// This pings the server to keep the instance warm without triggering a reset
function keepAlive() {
    axios.get(`${APP_URL}/api/ping`).catch(() => {});
}
setInterval(keepAlive, 300000); // Every 5 minutes for reliability on free tiers

// Global Station State
let playlist = [
    { id: 'initial-01', title: "RADAR SYSTEM ONLINE", url: "https://radar-dance-radio.onrender.com/", isLocal: false }
];

let broadcastStatus = {
    isLive: true,
    isDjLinked: false,
    nowPlaying: "RADAR STANDBY",
    currentTrackIndex: 0,
    startTime: Date.now(),
    listeners: Math.floor(Math.random() * 20) + 5
};

// --- PREMIUM LISTENER UI ---
const listenerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RADAR // GLOBAL</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Syncopate:wght@700&family=Inter:wght@300;900&display=swap" rel="stylesheet">
    <style>
        :root { --pink: #ff007f; --black: #020203; --white: #f0f0f5; }
        body { background-color: var(--black); color: var(--white); font-family: 'Inter', sans-serif; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        .font-sync { font-family: 'Syncopate', sans-serif; }
        .text-pink { color: var(--pink); }
        .bg-pink { background-color: var(--pink); }
        .bar { width: 4px; background: var(--pink); border-radius: 2px; animation: bounce 1s ease-in-out infinite; }
        @keyframes bounce { 0%, 100% { height: 10px; opacity: 0.3; } 50% { height: 40px; opacity: 1; } }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255, 0, 127, 0.2); }
        .on-air-pulse { animation: pulse-red 2s infinite; }
        @keyframes pulse-red { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    </style>
</head>
<body class="p-6 md:p-12">
    <nav class="flex justify-between items-center mb-8">
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 bg-pink rounded-full flex items-center justify-center font-black italic text-black text-xl">R</div>
            <h1 class="font-sync text-2xl tracking-tighter uppercase italic">Radar<span class="text-pink">.</span></h1>
        </div>
        <div id="status-badge" class="flex items-center gap-3 px-5 py-2 bg-white/5 border border-white/10 rounded-full">
            <span class="w-2 h-2 bg-green-500 rounded-full on-air-pulse"></span>
            <span class="text-[10px] font-black uppercase tracking-[0.2em]">Signal Active</span>
        </div>
    </nav>

    <main class="flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-full max-w-4xl space-y-12">
            <div class="space-y-4">
                <p class="text-[10px] font-bold text-pink uppercase tracking-[0.6em]">Synchronized Transmission</p>
                <h2 id="track-title" class="text-4xl md:text-7xl font-black italic uppercase leading-tight tracking-tighter">--:--</h2>
            </div>

            <div class="flex items-center justify-center gap-1.5 h-16 opacity-40">
                <div class="bar" style="animation-delay: 0.1s"></div>
                <div class="bar" style="animation-delay: 0.3s"></div>
                <div class="bar" style="animation-delay: 0.2s"></div>
                <div class="bar" style="animation-delay: 0.5s"></div>
                <div class="bar" style="animation-delay: 0.4s"></div>
            </div>

            <div class="glass-panel p-12 rounded-[40px] shadow-2xl">
                <div class="flex flex-col md:flex-row items-center gap-12">
                    <button id="playBtn" class="w-24 h-24 md:w-32 md:h-32 bg-white text-black rounded-full flex items-center justify-center hover:bg-pink hover:text-white transition-all transform active:scale-90">
                        <svg id="playIcon" class="w-10 h-10 md:w-12 md:h-12 fill-current translate-x-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    
                    <div class="flex-1 w-full space-y-6">
                        <div class="flex justify-between text-[10px] font-black uppercase text-gray-500">
                            <span>Gain Control</span>
                            <span id="vol-text">70%</span>
                        </div>
                        <input type="range" id="vol" min="0" max="1" step="0.01" value="0.7" class="w-full accent-pink bg-white/10 h-1 appearance-none cursor-pointer">
                    </div>
                </div>
            </div>
        </div>
    </main>

    <footer class="flex justify-between items-end text-[10px] font-bold text-gray-500 uppercase tracking-widest pt-8">
        <div>
            <span class="block text-pink mb-1">Nodes Connected</span>
            <span id="listener-count" class="text-2xl text-white font-black italic">--</span>
        </div>
        <div class="text-right">
            <span class="block text-pink mb-1">System Engine</span>
            <span class="text-2xl text-white font-black italic tracking-tighter italic">V3.5_TURBO</span>
        </div>
    </footer>

    <audio id="audio" crossOrigin="anonymous"></audio>

    <script>
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const trackTitle = document.getElementById('track-title');
        const listenerCount = document.getElementById('listener-count');
        let serverStartTime = 0;

        async function syncWithServer() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                trackTitle.innerText = data.isDjLinked ? "LIVE DJ SET // ACTIVE" : data.nowPlaying;
                listenerCount.innerText = data.listeners.toString().padStart(3, '0');
                
                if (serverStartTime !== data.startTime) {
                    serverStartTime = data.startTime;
                    const elapsed = (Date.now() - data.startTime) / 1000;
                    audio.src = "/stream?t=" + data.startTime;
                    audio.load();
                    audio.oncanplay = () => {
                        if (audio.duration && elapsed < audio.duration) {
                            audio.currentTime = elapsed;
                        }
                    };
                    if(!audio.paused) audio.play().catch(() => {});
                }
            } catch(e) {}
        }
        setInterval(syncWithServer, 5000);
        syncWithServer();

        playBtn.onclick = () => {
            if(!audio.src) audio.src = "/stream?t=" + Date.now();
            if (audio.paused) {
                audio.play();
                document.getElementById('playIcon').innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
            } else {
                audio.pause();
                document.getElementById('playIcon').innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        };
        document.getElementById('vol').oninput = (e) => {
            audio.volume = e.target.value;
            document.getElementById('vol-text').innerText = Math.round(e.target.value * 100) + "%";
        };
    </script>
</body>
</html>
`;

// --- ADMIN UI --- (Includes Progress Bar + Turbo Upload)
const adminHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>RADAR // COMMAND</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #f0f2f5; color: #05070a; font-family: 'Inter', sans-serif; }
        .card { background: white; border: 4px solid #05070a; box-shadow: 10px 10px 0px #ff007f; }
        .progress-bar { transition: width 0.3s ease; }
    </style>
</head>
<body class="p-8">
    <div class="max-w-6xl mx-auto">
        <header class="flex justify-between items-end mb-12 border-b-4 border-black pb-6">
            <h1 class="text-5xl font-black italic uppercase tracking-tighter">Radar Control</h1>
            <div class="flex gap-4">
                <button onclick="toggleStatus('live')" class="bg-black text-white px-6 py-2 font-black uppercase text-xs">Power</button>
                <button onclick="toggleStatus('dj')" class="bg-black text-white px-6 py-2 font-black uppercase text-xs">DJ Set</button>
            </div>
        </header>

        <div class="grid lg:grid-cols-2 gap-10">
            <div class="card p-8 min-h-[400px]">
                <h2 class="text-2xl font-black uppercase italic mb-6">Queue</h2>
                <div id="playlist-list" class="space-y-3"></div>
            </div>

            <div class="space-y-6">
                <div class="card p-8 bg-black text-white">
                    <h2 class="text-xl font-black mb-4 uppercase text-pink-500">Turbo Bulk Upload</h2>
                    <input type="file" id="file-input" multiple accept="audio/*" class="hidden" onchange="handleUpload(this.files)">
                    <button id="upload-trigger" onclick="document.getElementById('file-input').click()" class="w-full bg-pink-500 py-4 font-black uppercase text-xs">Select Album</button>
                    
                    <!-- PROGRESS BAR UI -->
                    <div id="progress-container" class="mt-6 hidden">
                        <div class="flex justify-between text-[10px] font-black uppercase mb-2">
                            <span id="up-status">Transmitting...</span>
                            <span id="up-percent">0%</span>
                        </div>
                        <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                            <div id="up-bar" class="progress-bar h-full bg-pink-500 w-0"></div>
                        </div>
                    </div>
                </div>
                <div class="card p-8">
                    <h2 class="text-xl font-black mb-4 uppercase">System State</h2>
                    <p class="text-[10px] text-gray-400 font-bold uppercase mb-4 tracking-widest">Anti-Sleep: Keep-Alive Active</p>
                    <button onclick="location.reload()" class="w-full bg-black text-white py-4 font-black uppercase text-xs">Refresh Admin UI</button>
                </div>
            </div>
        </div>
    </div>
    <script>
        async function fetchAdminState() {
            const res = await fetch('/api/status');
            const status = await res.json();
            const pRes = await fetch('/api/playlist');
            const playlist = await pRes.json();
            
            document.getElementById('playlist-list').innerHTML = playlist.map((t, i) => \`
                <div class="flex items-center justify-between p-4 border-2 border-black \${status.currentTrackIndex === i ? 'bg-pink-50 border-pink-500' : ''}">
                    <div class="font-black uppercase text-xs">\${t.title}</div>
                    <div class="flex gap-2">
                        <button onclick="playTrack(\${i})" class="bg-black text-white px-4 py-1 text-[10px] font-black">PLAY</button>
                        <button onclick="deleteTrack(\${i})" class="border border-black px-2 text-[10px] font-black hover:bg-red-500 hover:text-white">X</button>
                    </div>
                </div>
            \`).join('');
        }

        function handleUpload(files) {
            if (!files.length) return;
            
            const btn = document.getElementById('upload-trigger');
            const container = document.getElementById('progress-container');
            const bar = document.getElementById('up-bar');
            const percentText = document.getElementById('up-percent');
            const statusText = document.getElementById('up-status');
            
            btn.disabled = true;
            container.classList.remove('hidden');
            
            const fd = new FormData();
            for(let f of files) fd.append('audioFiles', f);
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = Math.round((e.loaded / e.total) * 100);
                    bar.style.width = percent + '%';
                    percentText.innerText = percent + '%';
                }
            };
            
            xhr.onload = () => {
                if (xhr.status === 200) {
                    statusText.innerText = "COMPLETED";
                    setTimeout(() => {
                        container.classList.add('hidden');
                        btn.disabled = false;
                        fetchAdminState();
                    }, 2000);
                } else {
                    statusText.innerText = "FAILED";
                    btn.disabled = false;
                }
            };
            
            xhr.send(fd);
        }

        async function toggleStatus(type) { await fetch('/api/broadcast/toggle/' + type, { method: 'POST' }); fetchAdminState(); }
        async function playTrack(i) { await fetch('/api/broadcast/play/'+i, {method:'POST'}); fetchAdminState(); }
        async function deleteTrack(i) { await fetch('/api/playlist/delete/'+i, {method:'POST'}); fetchAdminState(); }
        
        fetchAdminState();
        setInterval(fetchAdminState, 8000);
    </script>
</body>
</html>
`;

// --- SERVER ROUTES ---

app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));
app.get('/api/ping', (req, res) => res.send('AWAKE')); // Lightweight keep-alive endpoint

app.post('/api/upload', upload.array('audioFiles'), (req, res) => {
    const newTracks = req.files.map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        title: f.originalname.replace(/\.[^/.]+$/, "").toUpperCase(),
        url: `/uploads/${f.filename}`,
        isLocal: true,
        path: f.path
    }));
    playlist = [...playlist, ...newTracks];
    res.json({ success: true });
});

app.get('/api/playlist', (req, res) => res.json(playlist));

app.post('/api/playlist/delete/:index', (req, res) => {
    const i = parseInt(req.params.index);
    if (playlist[i]) {
        if (playlist[i].isLocal && fs.existsSync(playlist[i].path)) {
            fs.unlinkSync(playlist[i].path);
        }
        playlist.splice(i, 1);
    }
    res.json({ success: true });
});

app.post('/api/broadcast/toggle/:type', (req, res) => {
    if(req.params.type === 'live') broadcastStatus.isLive = !broadcastStatus.isLive;
    if(req.params.type === 'dj') broadcastStatus.isDjLinked = !broadcastStatus.isDjLinked;
    broadcastStatus.startTime = Date.now();
    res.json(broadcastStatus);
});

app.post('/api/broadcast/play/:index', (req, res) => {
    const i = parseInt(req.params.index);
    if (playlist[i]) {
        broadcastStatus.currentTrackIndex = i;
        broadcastStatus.nowPlaying = playlist[i].title;
        broadcastStatus.startTime = Date.now();
        res.json({ success: true });
    }
});

app.get('/api/status', (req, res) => res.json(broadcastStatus));

app.get('/stream', async (req, res) => {
    try {
        const track = playlist[broadcastStatus.currentTrackIndex];
        if (!track || !broadcastStatus.isLive) return res.status(404).send("Off-Air");
        
        if (track.isLocal) {
            const filePath = track.path;
            const stat = fs.statSync(filePath);
            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(filePath, {start, end});
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'audio/mpeg',
                });
                file.pipe(res);
            } else {
                res.writeHead(200, {
                    'Content-Length': stat.size,
                    'Content-Type': 'audio/mpeg',
                    'Accept-Ranges': 'bytes'
                });
                fs.createReadStream(filePath).pipe(res);
            }
        } else {
            const response = await axios({ method: 'get', url: track.url, responseType: 'stream' });
            res.setHeader('Content-Type', 'audio/mpeg');
            response.data.pipe(res);
        }
    } catch (e) { res.status(500).send("Stream error"); }
});

app.listen(PORT, () => {
    console.log(`Radar Engine v3.5_TURBO listening on ${PORT}`);
    setTimeout(keepAlive, 5000);
});