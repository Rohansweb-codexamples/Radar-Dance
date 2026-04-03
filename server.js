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

// Optimized Multer for Multiple Files
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

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

app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// --- ULTRA-PREMIUM LISTENER UI ---
const listenerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RADAR // GLOBAL TRANSMISSION</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Syncopate:wght@700&family=Inter:wght@300;900&display=swap" rel="stylesheet">
    <style>
        :root { --pink: #ff007f; --black: #020203; --navy: #0a0c12; --white: #f0f0f5; }
        body { background-color: var(--black); color: var(--white); font-family: 'Inter', sans-serif; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        .font-sync { font-family: 'Syncopate', sans-serif; }
        .text-pink { color: var(--pink); }
        .bg-pink { background-color: var(--pink); }
        
        /* Visualizer Animation */
        .bar { width: 4px; background: var(--pink); border-radius: 2px; animation: bounce 1s ease-in-out infinite; }
        @keyframes bounce { 
            0%, 100% { height: 10px; opacity: 0.3; } 
            50% { height: 40px; opacity: 1; } 
        }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(15px); border: 1px solid rgba(255, 0, 127, 0.15); }
        .on-air-pulse { animation: pulse-red 2s infinite; }
        @keyframes pulse-red { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
    </style>
</head>
<body class="p-6 md:p-12">
    <nav class="flex justify-between items-center mb-12">
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 bg-pink rounded-full flex items-center justify-center font-black italic text-black">R</div>
            <h1 class="font-sync text-2xl tracking-tighter uppercase italic">Radar<span class="text-pink">.</span></h1>
        </div>
        <div id="status-badge" class="flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
            <span class="w-2 h-2 bg-green-500 rounded-full on-air-pulse"></span>
            <span class="text-[10px] font-black uppercase tracking-[0.2em]">Live Signal</span>
        </div>
    </nav>

    <main class="flex-1 flex flex-col items-center justify-center text-center">
        <div class="w-full max-w-3xl space-y-12">
            <!-- Frequency Header -->
            <div class="space-y-4">
                <p class="text-[10px] font-bold text-pink uppercase tracking-[0.5em]">Global Transmission Mode</p>
                <h2 id="track-title" class="text-5xl md:text-8xl font-black italic uppercase leading-none tracking-tighter">--:--</h2>
            </div>

            <!-- Visualizer Area -->
            <div class="flex items-center justify-center gap-1 h-12 opacity-50">
                <div class="bar" style="animation-delay: 0.1s"></div>
                <div class="bar" style="animation-delay: 0.3s"></div>
                <div class="bar" style="animation-delay: 0.2s"></div>
                <div class="bar" style="animation-delay: 0.5s"></div>
                <div class="bar" style="animation-delay: 0.4s"></div>
            </div>

            <!-- Player Panel -->
            <div class="glass-panel p-10 rounded-3xl shadow-2xl relative group">
                <div class="flex flex-col md:flex-row items-center gap-12">
                    <button id="playBtn" class="w-28 h-28 bg-white text-black rounded-full flex items-center justify-center hover:bg-pink hover:text-white transition-all transform active:scale-95 shadow-xl">
                        <svg id="playIcon" class="w-10 h-10 fill-current translate-x-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    
                    <div class="flex-1 w-full space-y-4">
                        <div class="flex justify-between items-end text-[10px] font-black uppercase text-gray-500 tracking-widest">
                            <span>System Gain</span>
                            <span id="vol-text">70%</span>
                        </div>
                        <input type="range" id="vol" min="0" max="1" step="0.01" value="0.7" class="w-full accent-pink bg-white/10 h-1 appearance-none cursor-pointer rounded-full">
                    </div>
                </div>
            </div>
        </div>
    </main>

    <footer class="flex justify-between items-end text-[10px] font-bold text-gray-500 uppercase tracking-widest">
        <div class="flex gap-8">
            <div>
                <span class="block text-pink mb-1">Listeners</span>
                <span id="listener-count" class="text-xl text-white font-black italic">--</span>
            </div>
            <div>
                <span class="block text-pink mb-1">UTC Time</span>
                <span id="utc-clock" class="text-xl text-white font-black italic">00:00:00</span>
            </div>
        </div>
        <div class="text-right">
            <span class="block text-pink mb-1">Engine</span>
            <span class="text-xl text-white font-black italic tracking-tighter">BCU-ENTERPRISE</span>
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
                
                trackTitle.innerText = data.isDjLinked ? "LIVE DJ SET // LINKED" : data.nowPlaying;
                listenerCount.innerText = data.listeners.toString().padStart(3, '0');
                
                if (!data.isLive) {
                    statusBadge.innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full"></span><span class="text-[10px] font-black uppercase">Off Air</span>';
                    audio.pause();
                    return;
                }

                statusBadge.innerHTML = '<span class="w-2 h-2 bg-green-500 rounded-full on-air-pulse"></span><span class="text-[10px] font-black uppercase">Live Signal</span>';

                if (serverStartTime !== data.startTime) {
                    serverStartTime = data.startTime;
                    const elapsedSeconds = (Date.now() - data.startTime) / 1000;
                    const playing = !audio.paused;
                    
                    audio.src = "/stream?t=" + data.startTime;
                    audio.load();
                    
                    // The magic sync: seek to where the server is
                    audio.oncanplay = () => {
                        if (audio.duration && elapsedSeconds < audio.duration) {
                            audio.currentTime = elapsedSeconds;
                        }
                    };

                    if(playing) audio.play().catch(() => {});
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
    <title>RADAR // COMMAND</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: #f8f9fb; color: #05070a; font-family: 'Inter', sans-serif; }
        .card { background: white; border: 4px solid #05070a; box-shadow: 12px 12px 0px #ff007f; }
        .toggle-active { background: #ff007f; color: white; }
    </style>
</head>
<body class="p-8 md:p-12">
    <div class="max-w-7xl mx-auto">
        <header class="flex justify-between items-end mb-12 border-b-8 border-black pb-8">
            <h1 class="text-6xl font-black italic uppercase tracking-tighter">Radar Control</h1>
            <div class="flex gap-4">
                <button id="toggle-live" onclick="toggleStatus('live')" class="px-6 py-2 border-4 border-black font-black uppercase text-xs">Station On/Off</button>
                <button id="toggle-dj" onclick="toggleStatus('dj')" class="px-6 py-2 border-4 border-black font-black uppercase text-xs">Link DJ Set</button>
            </div>
        </header>

        <div class="grid lg:grid-cols-12 gap-12">
            <!-- Queue -->
            <div class="lg:col-span-8">
                <div class="card p-8 min-h-[500px]">
                    <div class="flex justify-between items-center mb-8">
                        <h2 class="text-3xl font-black uppercase italic tracking-tight">Broadcast Queue</h2>
                        <button onclick="clearAll()" class="text-[10px] font-bold text-red-500 uppercase">Clear All</button>
                    </div>
                    <div id="playlist-list" class="space-y-4"></div>
                </div>
            </div>

            <!-- Upload Tools -->
            <div class="lg:col-span-4 space-y-8">
                <div class="card p-8 bg-black text-white">
                    <h2 class="text-xl font-black mb-6 uppercase text-pink-500 italic">Bulk Audio Upload</h2>
                    <input type="file" id="file-input" multiple class="hidden" onchange="handleUpload(this.files)">
                    <button onclick="document.getElementById('file-input').click()" class="w-full bg-pink-500 py-6 font-black uppercase text-xs tracking-widest mb-4">Select Files</button>
                    <div id="up-progress" class="text-[10px] uppercase font-bold text-pink-500 text-center"></div>
                </div>

                <div class="card p-8">
                    <h2 class="text-xs font-black uppercase mb-4 text-gray-400">Stream Links</h2>
                    <textarea id="bulk-urls" rows="3" class="w-full bg-gray-100 p-4 text-xs mb-4 outline-none border-2 border-transparent focus:border-pink-500" placeholder="URL | Title"></textarea>
                    <button onclick="addUrls()" class="w-full bg-black text-white py-4 font-black uppercase text-xs">Add Streams</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function fetchAdminState() {
            const res = await fetch('/api/status');
            const status = await res.json();
            
            document.getElementById('toggle-live').className = \`px-6 py-2 border-4 border-black font-black uppercase text-xs \${status.isLive ? 'bg-green-500' : 'bg-red-500'}\`;
            document.getElementById('toggle-dj').className = \`px-6 py-2 border-4 border-black font-black uppercase text-xs \${status.isDjLinked ? 'bg-pink-500 text-white' : ''}\`;

            const pRes = await fetch('/api/playlist');
            const playlist = await pRes.json();
            const list = document.getElementById('playlist-list');
            
            list.innerHTML = playlist.map((t, i) => \`
                <div class="flex items-center justify-between p-4 border-2 border-black group \${status.currentTrackIndex === i ? 'border-pink-500 bg-pink-50' : ''}">
                    <div class="flex items-center gap-4">
                        <span class="text-sm font-black \${status.currentTrackIndex === i ? 'text-pink-500' : 'text-gray-300'}">\${(i+1).toString().padStart(2, '0')}</span>
                        <div class="font-black uppercase text-sm">\${t.title}</div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="playTrack(\${i})" class="bg-black text-white px-4 py-1 text-[10px] font-black uppercase italic hover:bg-pink-500">Go Live</button>
                        <button onclick="deleteTrack(\${i})" class="text-[10px] font-black border border-black px-2 py-1 hover:bg-black hover:text-white transition-all">X</button>
                    </div>
                </div>
            \`).join('');
        }

        async function handleUpload(files) {
            const status = document.getElementById('up-progress');
            status.innerText = "Transmitting bulk data...";
            const fd = new FormData();
            for(let f of files) fd.append('audioFiles', f);
            await fetch('/api/upload', { method: 'POST', body: fd });
            status.innerText = "Locked & Loaded.";
            setTimeout(() => status.innerText = "", 3000);
            fetchAdminState();
        }

        async function toggleStatus(type) {
            await fetch('/api/broadcast/toggle/' + type, { method: 'POST' });
            fetchAdminState();
        }

        async function playTrack(i) { await fetch('/api/broadcast/play/'+i, {method:'POST'}); fetchAdminState(); }
        async function deleteTrack(i) { await fetch('/api/playlist/delete/'+i, {method:'POST'}); fetchAdminState(); }
        async function clearAll() { if(confirm("Wipe?")) { await fetch('/api/playlist/clear', {method:'POST'}); fetchAdminState(); }}
        async function addUrls() {
            const v = document.getElementById('bulk-urls').value;
            const tracks = v.split('\\n').filter(l=>l.trim()).map(l=>{
                const p = l.split('|');
                return { url: p[0].trim(), title: (p[1]||"Remote").trim().toUpperCase(), isLocal: false };
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
        setInterval(fetchAdminState, 5000);
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
    broadcastStatus.startTime = Date.now(); // Reset sync
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
        if (!track || !broadcastStatus.isLive) return res.status(404).send("Silence");
        
        if (track.isLocal) {
            res.setHeader('Content-Type', 'audio/mpeg');
            fs.createReadStream(track.path).pipe(res);
        } else {
            const response = await axios({ method: 'get', url: track.url, responseType: 'stream', timeout: 10000 });
            res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
            response.data.pipe(res);
        }
    } catch (e) { res.status(500).send("Signal Error"); }
});

app.listen(PORT, () => console.log('Radar synced on ' + PORT));