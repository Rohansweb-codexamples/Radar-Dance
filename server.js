const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

// Setup directories
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ storage: storage });

// Global Station State
let playlist = [
    { id: 'initial-01', title: "RADAR WELCOME SIGNAL", url: "https://radar-dance-radio.onrender.com/", isLocal: false }
];

let broadcastStatus = {
    nowPlaying: "RADAR ONLINE",
    currentTrackIndex: 0,
    startTime: Date.now(),
    listeners: Math.floor(Math.random() * 50) + 10,
    status: "LIVE"
};

app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// --- ADVANCED LISTENER UI ---
const listenerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RADAR // LIVE</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Syncopate:wght@700&family=Inter:wght@400;900&display=swap" rel="stylesheet">
    <style>
        :root { --pink: #ff007f; --black: #05070a; --white: #f0f0f5; }
        body { background-color: var(--black); color: var(--white); font-family: 'Inter', sans-serif; overflow: hidden; }
        .font-sync { font-family: 'Syncopate', sans-serif; }
        .text-pink { color: var(--pink); }
        .bg-pink { background-color: var(--pink); }
        .glass { background: rgba(10, 12, 18, 0.8); backdrop-filter: blur(20px); border: 1px solid rgba(255, 0, 127, 0.2); }
    </style>
</head>
<body class="h-screen flex flex-col justify-between p-8 md:p-16">
    <header class="flex justify-between items-start">
        <h1 class="text-6xl md:text-8xl font-black font-sync italic tracking-tighter uppercase leading-none">Radar<span class="text-pink">.</span></h1>
        <div class="text-right border-l-2 border-pink pl-4">
            <div class="text-[10px] font-black text-pink uppercase tracking-widest">Signal Status</div>
            <div class="font-mono text-xl font-bold uppercase italic">Encrypted // Live</div>
        </div>
    </header>

    <main class="flex flex-col items-center">
        <div class="w-full max-w-4xl glass p-12 rounded-sm relative overflow-hidden shadow-2xl">
            <div class="mb-16">
                <p class="text-[10px] font-bold uppercase text-gray-500 tracking-[0.3em] mb-2">Currently Transmitting</p>
                <h2 id="track-title" class="text-4xl md:text-6xl font-black italic uppercase tracking-tight leading-tight">Syncing Signal...</h2>
            </div>
            <div class="flex flex-col md:flex-row items-center gap-12">
                <button id="playBtn" class="w-32 h-32 flex items-center justify-center bg-pink rounded-full hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,0,127,0.4)]">
                    <svg id="playIcon" class="w-12 h-12 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <div class="flex-1 w-full">
                    <div class="flex justify-between text-[10px] font-black uppercase text-gray-500 mb-4 tracking-widest">
                        <span>Volume</span>
                        <span id="vol-display">70%</span>
                    </div>
                    <input type="range" id="vol" min="0" max="1" step="0.01" value="0.7" class="w-full accent-pink bg-gray-800 h-1 appearance-none cursor-pointer">
                </div>
            </div>
        </div>
    </main>

    <footer class="flex justify-between items-end">
        <div>
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Online Nodes</p>
            <p id="listener-count" class="text-2xl font-black italic">--</p>
        </div>
        <div class="text-right">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">System</p>
            <p class="text-lg font-bold italic uppercase">Broadcast Control Unit</p>
        </div>
    </footer>

    <audio id="audio" crossOrigin="anonymous"></audio>
    <script>
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const trackTitle = document.getElementById('track-title');
        const listenerCount = document.getElementById('listener-count');
        let currentSync = 0;

        async function update() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                trackTitle.innerText = data.nowPlaying;
                listenerCount.innerText = data.listeners.toString().padStart(3, '0');
                if (currentSync !== data.startTime) {
                    currentSync = data.startTime;
                    const playing = !audio.paused;
                    audio.src = "/stream?t=" + data.startTime;
                    if(playing) audio.play().catch(() => {});
                }
            } catch(e) {}
        }
        setInterval(update, 3000);
        update();

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
            document.getElementById('vol-display').innerText = Math.round(e.target.value * 100) + "%";
        };
    </script>
</body>
</html>
`;

// --- ADVANCED ADMIN UI ---
const adminHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>RADAR // ADMIN</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root { --pink: #ff007f; --black: #05070a; --white: #f0f0f5; }
        body { background-color: var(--white); color: var(--black); font-family: 'Inter', sans-serif; }
        .card { background: white; border: 4px solid var(--black); box-shadow: 12px 12px 0px var(--pink); transition: all 0.2s; }
        .card:hover { transform: translate(-2px, -2px); box-shadow: 16px 16px 0px var(--black); }
        .btn-black { background: var(--black); color: white; font-weight: 900; text-transform: uppercase; font-style: italic; }
        .btn-black:hover { background: var(--pink); }
    </style>
</head>
<body class="p-8 md:p-12">
    <div class="max-w-7xl mx-auto">
        <header class="flex justify-between items-end mb-16 border-b-8 border-black pb-8">
            <div>
                <h1 class="text-7xl font-black italic uppercase tracking-tighter leading-none">Radar<span class="text-pink">.</span> Control</h1>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-[0.3em] mt-4">Broadcast Administration // Version 3.0</p>
            </div>
            <div class="text-right">
                <div class="text-[10px] font-black text-gray-400 uppercase">System Status</div>
                <div class="text-4xl font-black italic text-green-500">READY</div>
            </div>
        </header>

        <div class="grid lg:grid-cols-12 gap-12">
            <!-- Left: Queue Manager -->
            <div class="lg:col-span-7 space-y-8">
                <div class="card p-8">
                    <div class="flex justify-between items-center mb-8">
                        <h2 class="text-3xl font-black uppercase italic">Active Queue</h2>
                        <button onclick="clearQueue()" class="text-[10px] font-black border-2 border-black px-4 py-1 hover:bg-black hover:text-white uppercase transition-all">Flush System</button>
                    </div>
                    <div id="playlist-list" class="space-y-3">
                        <!-- Items injected here -->
                    </div>
                </div>
            </div>

            <!-- Right: Tools -->
            <div class="lg:col-span-5 space-y-8">
                <!-- FILE UPLOAD CARD -->
                <div class="card p-8 bg-black text-white shadow-[12px_12px_0px_#222]">
                    <h2 class="text-2xl font-black mb-6 uppercase text-pink italic tracking-widest">Master Upload</h2>
                    <div class="border-2 border-dashed border-gray-700 p-8 text-center hover:border-pink transition-all cursor-pointer group" onclick="document.getElementById('file-input').click()">
                        <input type="file" id="file-input" multiple accept="audio/*" class="hidden" onchange="uploadFiles(this.files)">
                        <div class="text-pink mb-4">
                            <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        </div>
                        <p class="text-xs font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Push Audio Files to Server</p>
                    </div>
                    <div id="up-status" class="mt-4 text-[10px] font-black uppercase text-pink text-center"></div>
                </div>

                <!-- BULK URL CARD -->
                <div class="card p-8">
                    <h2 class="text-xl font-black mb-4 uppercase italic">Bulk Ingest</h2>
                    <p class="text-[9px] font-bold text-gray-400 uppercase mb-4 tracking-widest">Format: URL | TITLE</p>
                    <textarea id="bulk-urls" rows="4" class="w-full bg-gray-50 border-2 border-black p-4 text-xs font-mono mb-4 outline-none focus:ring-2 focus:ring-pink" placeholder="https://stream.com/live | Night Mix"></textarea>
                    <button onclick="addUrls()" class="w-full btn-black py-4 text-sm tracking-[0.2em]">Add to Playlist</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function fetchState() {
            const res = await fetch('/api/status');
            const status = await res.json();
            
            const pRes = await fetch('/api/playlist');
            const playlist = await pRes.json();
            
            const list = document.getElementById('playlist-list');
            if(playlist.length === 0) {
                list.innerHTML = '<div class="p-12 text-center text-gray-300 font-black uppercase italic">No Signal Found</div>';
                return;
            }

            list.innerHTML = playlist.map((t, i) => \`
                <div class="flex items-center justify-between p-5 border-2 border-black group \${status.currentTrackIndex === i ? 'bg-pink/5 border-pink' : 'hover:bg-gray-50'}">
                    <div class="flex items-center gap-6">
                        <span class="text-xl font-black \${status.currentTrackIndex === i ? 'text-pink' : 'text-gray-200'} italic">\${(i+1).toString().padStart(2, '0')}</span>
                        <div>
                            <div class="font-black uppercase text-lg italic tracking-tight">\${t.title}</div>
                            <div class="text-[9px] font-bold text-gray-400 uppercase">\${t.isLocal ? 'Local File' : 'Stream Ingest'}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                         \${status.currentTrackIndex === i ? 
                            '<span class="text-[10px] font-black bg-pink text-white px-4 py-2 uppercase italic">ON AIR</span>' : 
                            \`<button onclick="playNow(\${i})" class="btn-black text-[10px] px-4 py-2">LIVE</button>\`}
                        <button onclick="deleteTrack(\${i})" class="text-[10px] font-black border border-black px-3 py-2 hover:bg-red-500 hover:text-white uppercase transition-all">X</button>
                    </div>
                </div>
            \`).join('');
        }

        async function uploadFiles(files) {
            if(!files.length) return;
            const status = document.getElementById('up-status');
            status.innerText = "Transmitting Data...";
            
            const fd = new FormData();
            for(let f of files) fd.append('audioFiles', f);
            
            try {
                await fetch('/api/upload', { method: 'POST', body: fd });
                status.innerText = "Signal Locked.";
                setTimeout(() => status.innerText = "", 3000);
                fetchState();
            } catch(e) { status.innerText = "Error."; }
        }

        async function addUrls() {
            const val = document.getElementById('bulk-urls').value;
            if(!val.trim()) return;
            const tracks = val.split('\\n').filter(l => l.trim()).map(l => {
                const parts = l.split('|');
                return { url: parts[0].trim(), title: (parts[1] || "Remote").trim().toUpperCase(), isLocal: false };
            });
            await fetch('/api/playlist/bulk', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tracks })
            });
            document.getElementById('bulk-urls').value = '';
            fetchState();
        }

        async function playNow(i) { await fetch('/api/broadcast/play/'+i, { method: 'POST' }); fetchState(); }
        async function deleteTrack(i) { await fetch('/api/playlist/delete/'+i, { method: 'POST' }); fetchState(); }
        async function clearQueue() { if(confirm("WIPE SYSTEM?")) { await fetch('/api/playlist/clear', {method: 'POST'}); fetchState(); }}

        fetchState();
        setInterval(fetchState, 5000);
    </script>
</body>
</html>
`;

// --- API ROUTES ---

app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));

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

app.post('/api/playlist/bulk', (req, res) => {
    playlist = [...playlist, ...req.body.tracks];
    res.json({ success: true });
});

app.post('/api/playlist/delete/:index', (req, res) => {
    const i = parseInt(req.params.index);
    if (i >= 0 && i < playlist.length) {
        const track = playlist[i];
        if (track.isLocal && fs.existsSync(track.path)) {
            try { fs.unlinkSync(track.path); } catch (e) {}
        }
        playlist.splice(i, 1);
        if (broadcastStatus.currentTrackIndex >= playlist.length) broadcastStatus.currentTrackIndex = 0;
    }
    res.json({ success: true });
});

app.post('/api/playlist/clear', (req, res) => {
    playlist.forEach(t => { if(t.isLocal && fs.existsSync(t.path)) fs.unlinkSync(t.path); });
    playlist = [];
    res.json({ success: true });
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
        if (!track) return res.status(404).send("Silence");
        if (track.isLocal) {
            if (fs.existsSync(track.path)) {
                res.setHeader('Content-Type', 'audio/mpeg');
                fs.createReadStream(track.path).pipe(res);
            } else res.status(404).send("Missing");
        } else {
            const response = await axios({ method: 'get', url: track.url, responseType: 'stream', timeout: 10000 });
            res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
            response.data.pipe(res);
        }
    } catch (e) { res.status(500).send("Signal Error"); }
});

app.listen(PORT, () => console.log('Radar active on port ' + PORT));