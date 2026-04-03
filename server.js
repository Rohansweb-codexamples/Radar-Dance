const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

// Setup directories with absolute paths
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// HIGH-PERFORMANCE MULTI-FILE CONFIG
// We use DiskStorage to stream files directly to disk instead of holding them in RAM
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, Date.now() + '-' + safeName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 200 * 1024 * 1024, // 200MB per file
        files: 50 // Allow up to 50 files (full albums) at once
    }
});

// Increase Express body limits for large metadata payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(uploadDir));

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
            <span class="text-[10px] font-black uppercase tracking-[0.2em]">Live Signal</span>
        </div>
    </nav>

    <main class="flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-full max-w-4xl space-y-12">
            <div class="space-y-4">
                <p class="text-[10px] font-bold text-pink uppercase tracking-[0.6em]">Synchronized Stream Active</p>
                <h2 id="track-title" class="text-5xl md:text-8xl font-black italic uppercase leading-tight tracking-tighter">SIGNAL SEARCH...</h2>
            </div>

            <div class="flex items-center justify-center gap-1.5 h-16 opacity-40">
                <div class="bar" style="animation-delay: 0.1s"></div>
                <div class="bar" style="animation-delay: 0.3s"></div>
                <div class="bar" style="animation-delay: 0.2s"></div>
                <div class="bar" style="animation-delay: 0.5s"></div>
                <div class="bar" style="animation-delay: 0.4s"></div>
                <div class="bar" style="animation-delay: 0.6s"></div>
            </div>

            <div class="glass-panel p-12 rounded-[40px] shadow-2xl transition-all hover:border-pink/40">
                <div class="flex flex-col md:flex-row items-center gap-12">
                    <button id="playBtn" class="w-32 h-32 bg-white text-black rounded-full flex items-center justify-center hover:bg-pink hover:text-white transition-all transform active:scale-90 shadow-2xl">
                        <svg id="playIcon" class="w-12 h-12 fill-current translate-x-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    
                    <div class="flex-1 w-full space-y-6">
                        <div class="flex justify-between items-end text-[10px] font-black uppercase text-gray-500 tracking-[0.2em]">
                            <span>System Output</span>
                            <span id="vol-text">70%</span>
                        </div>
                        <input type="range" id="vol" min="0" max="1" step="0.01" value="0.7" class="w-full accent-pink bg-white/10 h-1.5 appearance-none cursor-pointer rounded-full">
                    </div>
                </div>
            </div>
        </div>
    </main>

    <footer class="flex justify-between items-end text-[10px] font-bold text-gray-500 uppercase tracking-widest border-t border-white/5 pt-8">
        <div class="flex gap-12">
            <div>
                <span class="block text-pink mb-1">Nodes</span>
                <span id="listener-count" class="text-2xl text-white font-black italic">--</span>
            </div>
            <div class="hidden md:block">
                <span class="block text-pink mb-1">Time (UTC)</span>
                <span id="utc-clock" class="text-2xl text-white font-black italic">00:00:00</span>
            </div>
        </div>
        <div class="text-right">
            <span class="block text-pink mb-1">Server Hash</span>
            <span class="text-2xl text-white font-black italic tracking-tighter">RD-v3.0.X</span>
        </div>
    </footer>

    <audio id="audio" crossOrigin="anonymous"></audio>

    <script>
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const trackTitle = document.getElementById('track-title');
        const listenerCount = document.getElementById('listener-count');
        const statusBadge = document.getElementById('status-badge');
        let serverStartTime = 0;

        function updateClock() {
            const now = new Date();
            document.getElementById('utc-clock').innerText = now.toISOString().substr(11, 8);
        }
        setInterval(updateClock, 1000);

        async function syncWithServer() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                
                trackTitle.innerText = data.isDjLinked ? "LIVE DJ SET // ACTIVE" : data.nowPlaying;
                listenerCount.innerText = data.listeners.toString().padStart(3, '0');
                
                if (!data.isLive) {
                    statusBadge.innerHTML = '<span class="w-2 h-2 bg-red-600 rounded-full"></span><span class="text-[10px] font-black uppercase">Off Air</span>';
                    audio.pause();
                    return;
                }

                statusBadge.innerHTML = '<span class="w-2 h-2 bg-green-500 rounded-full on-air-pulse"></span><span class="text-[10px] font-black uppercase">Live Signal</span>';

                if (serverStartTime !== data.startTime) {
                    serverStartTime = data.startTime;
                    const elapsedSeconds = (Date.now() - data.startTime) / 1000;
                    
                    audio.src = "/stream?t=" + data.startTime;
                    audio.load();
                    
                    audio.oncanplay = () => {
                        if (audio.duration && elapsedSeconds < audio.duration) {
                            audio.currentTime = elapsedSeconds;
                        }
                    };

                    if(!audio.paused) audio.play().catch(() => {});
                }
            } catch(e) {}
        }

        setInterval(syncWithServer, 4000);
        syncWithServer();

        playBtn.onclick = () => {
            if(!audio.src) audio.src = "/stream?t=" + Date.now();
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
            document.getElementById('vol-text').innerText = Math.round(e.target.value * 100) + "%";
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
        body { background: #f0f2f5; color: #05070a; font-family: 'Inter', sans-serif; }
        .card { background: white; border: 4px solid #05070a; box-shadow: 12px 12px 0px #ff007f; transition: transform 0.1s; }
        .card:active { transform: translate(4px, 4px); box-shadow: 8px 8px 0px #ff007f; }
        .btn-black { background: #05070a; color: white; text-transform: uppercase; font-weight: 900; font-style: italic; }
        .btn-black:hover { background: #ff007f; }
    </style>
</head>
<body class="p-8 md:p-12">
    <div class="max-w-7xl mx-auto">
        <header class="flex justify-between items-end mb-16 border-b-8 border-black pb-8">
            <div>
                <h1 class="text-7xl font-black italic uppercase tracking-tighter leading-none">Radar<span class="text-pink-500">.</span> Admin</h1>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-[0.4em] mt-4">Multi-Upload Command Center</p>
            </div>
            <div class="flex gap-4">
                <button id="toggle-live" onclick="toggleStatus('live')" class="btn-black px-8 py-3 border-4 border-black text-xs">Station Power</button>
                <button id="toggle-dj" onclick="toggleStatus('dj')" class="btn-black px-8 py-3 border-4 border-black text-xs">Link DJ Gear</button>
            </div>
        </header>

        <div class="grid lg:grid-cols-12 gap-12">
            <!-- Left: Queue -->
            <div class="lg:col-span-7">
                <div class="card p-8 min-h-[600px]">
                    <div class="flex justify-between items-center mb-10">
                        <h2 class="text-3xl font-black uppercase italic tracking-tight">Broadcast Flow</h2>
                        <button onclick="clearAll()" class="text-[10px] font-black border-2 border-black px-4 py-1 hover:bg-black hover:text-white uppercase">Flush All</button>
                    </div>
                    <div id="playlist-list" class="space-y-4"></div>
                </div>
            </div>

            <!-- Right: Fast Upload -->
            <div class="lg:col-span-5 space-y-10">
                <div class="card p-10 bg-black text-white shadow-[12px_12px_0px_#333]">
                    <h2 class="text-2xl font-black mb-8 uppercase text-pink-500 italic">High-Speed Upload</h2>
                    <div class="border-4 border-dashed border-gray-700 p-12 text-center hover:border-pink-500 transition-all cursor-pointer group rounded-xl" onclick="document.getElementById('file-input').click()">
                        <input type="file" id="file-input" multiple accept="audio/*" class="hidden" onchange="handleUpload(this.files)">
                        <div class="text-pink-500 mb-6 group-hover:scale-110 transition-transform">
                            <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        </div>
                        <p class="text-sm font-black uppercase tracking-widest text-gray-400 group-hover:text-white">Drop Album / Files Here</p>
                    </div>
                    <div id="up-container" class="mt-8 hidden">
                        <div class="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                            <div id="up-bar" class="h-full bg-pink-500 w-0 transition-all duration-300"></div>
                        </div>
                        <p id="up-status" class="text-[10px] font-black uppercase text-pink-500 text-center mt-4 tracking-widest">Transmitting...</p>
                    </div>
                </div>

                <div class="card p-10">
                    <h2 class="text-xl font-black mb-6 uppercase italic">Remote Stream Ingest</h2>
                    <textarea id="bulk-urls" rows="3" class="w-full bg-gray-50 border-4 border-black p-5 text-xs font-mono mb-6 outline-none focus:border-pink-500" placeholder="URL | TRACK NAME"></textarea>
                    <button onclick="addUrls()" class="w-full btn-black py-5 text-sm tracking-widest">Lock Signals</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function fetchAdminState() {
            const res = await fetch('/api/status');
            const status = await res.json();
            
            document.getElementById('toggle-live').style.backgroundColor = status.isLive ? '#22c55e' : '#ef4444';
            document.getElementById('toggle-dj').style.backgroundColor = status.isDjLinked ? '#ff007f' : '#05070a';

            const pRes = await fetch('/api/playlist');
            const playlist = await pRes.json();
            const list = document.getElementById('playlist-list');
            
            list.innerHTML = playlist.map((t, i) => \`
                <div class="flex items-center justify-between p-6 border-4 border-black group \${status.currentTrackIndex === i ? 'bg-pink-50 border-pink-500' : 'hover:bg-gray-50'}">
                    <div class="flex items-center gap-6">
                        <span class="text-2xl font-black \${status.currentTrackIndex === i ? 'text-pink-500' : 'text-gray-200'} italic">\${(i+1).toString().padStart(2, '0')}</span>
                        <div>
                            <div class="font-black uppercase text-lg italic tracking-tighter">\${t.title}</div>
                            <div class="text-[9px] font-bold text-gray-400 uppercase">\${t.isLocal ? 'DISK FILE' : 'REMOTE NODE'}</div>
                        </div>
                    </div>
                    <div class="flex gap-3">
                        <button onclick="playTrack(\${i})" class="btn-black text-[10px] px-6 py-2">Go Live</button>
                        <button onclick="deleteTrack(\${i})" class="text-[10px] font-black border-2 border-black px-4 py-2 hover:bg-red-500 hover:text-white transition-all uppercase">X</button>
                    </div>
                </div>
            \`).join('');
        }

        async function handleUpload(files) {
            if(!files.length) return;
            const container = document.getElementById('up-container');
            const bar = document.getElementById('up-bar');
            const status = document.getElementById('up-status');
            
            container.classList.remove('hidden');
            status.innerText = "Transmitting Station Data...";
            
            const fd = new FormData();
            for(let f of files) fd.append('audioFiles', f);
            
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload', true);
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    bar.style.width = percent + '%';
                    status.innerText = \`Transmitting: \${Math.round(percent)}%\`;
                }
            };

            xhr.onload = () => {
                if(xhr.status === 200) {
                    status.innerText = "Transmission Complete.";
                    setTimeout(() => { container.classList.add('hidden'); bar.style.width = '0'; }, 2000);
                    fetchAdminState();
                } else {
                    status.innerText = "Signal Failure.";
                }
            };

            xhr.send(fd);
        }

        async function toggleStatus(type) {
            await fetch('/api/broadcast/toggle/' + type, { method: 'POST' });
            fetchAdminState();
        }

        async function playTrack(i) { await fetch('/api/broadcast/play/'+i, {method:'POST'}); fetchAdminState(); }
        async function deleteTrack(i) { await fetch('/api/playlist/delete/'+i, {method:'POST'}); fetchAdminState(); }
        async function clearAll() { if(confirm("Flush System?")) { await fetch('/api/playlist/clear', {method:'POST'}); fetchAdminState(); }}
        async function addUrls() {
            const v = document.getElementById('bulk-urls').value;
            const tracks = v.split('\\n').filter(l=>l.trim()).map(l=>{
                const p = l.split('|');
                return { url: p[0].trim(), title: (p[1]||"Remote Node").trim().toUpperCase(), isLocal: false };
            });
            await fetch('/api/playlist/bulk', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tracks })
            });
            document.getElementById('bulk-urls').value = '';
            fetchAdminState();
        }

        fetchAdminState();
        setInterval(fetchAdminState, 6000);
    </script>
</body>
</html>
`;

// --- SERVER API ---

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

app.post('/api/playlist/delete/:index', (req, res) => {
    const i = parseInt(req.params.index);
    if (i >= 0 && i < playlist.length) {
        if(playlist[i].isLocal && fs.existsSync(playlist[i].path)) fs.unlinkSync(playlist[i].path);
        playlist.splice(i, 1);
    }
    res.json({ success: true });
});

app.post('/api/playlist/clear', (req, res) => {
    playlist.forEach(t => { if(t.isLocal && fs.existsSync(t.path)) fs.unlinkSync(t.path); });
    playlist = [];
    res.json({ success: true });
});

app.get('/api/status', (req, res) => res.json(broadcastStatus));

app.get('/stream', async (req, res) => {
    try {
        const track = playlist[broadcastStatus.currentTrackIndex];
        if (!track || !broadcastStatus.isLive) return res.status(404).send("Off-Air");
        
        if (track.isLocal) {
            const stat = fs.statSync(track.path);
            res.writeHead(200, {
                'Content-Type': 'audio/mpeg',
                'Content-Length': stat.size,
                'Accept-Ranges': 'bytes'
            });
            fs.createReadStream(track.path).pipe(res);
        } else {
            const response = await axios({ method: 'get', url: track.url, responseType: 'stream', timeout: 15000 });
            res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
            response.data.pipe(res);
        }
    } catch (e) { res.status(500).send("Signal Error"); }
});

app.listen(PORT, () => console.log('Radar Broadcast Unit Online on ' + PORT));