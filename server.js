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
    { id: 'initial-01', title: "RADAR WELCOME SIGNAL", url: "https://radar-dance-radio.onrender.com/", isLocal: false, duration: 'LIVE' }
];

let broadcastStatus = {
    nowPlaying: "STATION ONLINE",
    currentTrackIndex: 0,
    startTime: Date.now(),
    listeners: Math.floor(Math.random() * 50) + 10,
    status: "BROADCASTING",
    peak: 142
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
    <title>RADAR // LIVE TRANSMISSION</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Syncopate:wght@400;700&family=Inter:wght@400;900&display=swap" rel="stylesheet">
    <style>
        :root { --pink: #ff007f; --navy-black: #05070a; --purple: #8a2be2; --navy-white: #f0f0f5; }
        body { background-color: var(--navy-black); color: var(--navy-white); font-family: 'Inter', sans-serif; overflow: hidden; }
        .font-sync { font-family: 'Syncopate', sans-serif; }
        .text-pink { color: var(--pink); }
        .bg-pink { background-color: var(--pink); }
        .border-pink { border-color: var(--pink); }
        .glass { background: rgba(10, 12, 18, 0.8); backdrop-filter: blur(20px); border: 1px solid rgba(255, 0, 127, 0.1); }
        .glow { box-shadow: 0 0 50px rgba(138, 43, 226, 0.15); }
    </style>
</head>
<body class="h-screen flex flex-col justify-between p-8 md:p-16">
    <header class="flex justify-between items-start">
        <div>
            <div class="flex items-center gap-3 mb-2">
                <span class="w-3 h-3 bg-pink rounded-full"></span>
                <span class="text-[10px] font-black tracking-[0.5em] uppercase text-pink">Live Broadcast Signal</span>
            </div>
            <h1 class="text-6xl md:text-8xl font-black font-sync italic tracking-tighter uppercase leading-none">Radar<span class="text-pink">.</span></h1>
        </div>
        <div class="text-right hidden md:block">
            <div class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Bitrate</div>
            <div class="font-mono text-xl font-bold">320KBPS / 48KHZ</div>
        </div>
    </header>

    <main class="flex flex-col items-center">
        <div class="w-full max-w-4xl glass p-12 glow rounded-sm relative overflow-hidden">
            <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink via-purple to-pink"></div>
            
            <div class="mb-16">
                <p class="text-[10px] font-bold uppercase text-gray-500 tracking-[0.3em] mb-4">Frequency Data</p>
                <h2 id="track-title" class="text-4xl md:text-6xl font-black italic uppercase tracking-tight leading-tight">Searching for signal...</h2>
            </div>

            <div class="flex flex-col md:flex-row items-center gap-12">
                <button id="playBtn" class="group relative w-32 h-32 flex items-center justify-center bg-pink rounded-full transition-transform active:scale-95">
                    <div class="absolute inset-0 rounded-full border-4 border-pink animate-ping opacity-20"></div>
                    <svg id="playIcon" class="w-12 h-12 text-white fill-current translate-x-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>

                <div class="flex-1 w-full space-y-6">
                    <div class="flex justify-between items-end">
                        <div>
                            <span class="block text-[10px] font-bold text-gray-500 uppercase">Volume Control</span>
                            <span id="vol-display" class="text-2xl font-black italic">70%</span>
                        </div>
                        <div class="text-right">
                             <span class="block text-[10px] font-bold text-gray-500 uppercase">Stereo Field</span>
                             <span class="text-xs font-bold text-pink uppercase">Balanced</span>
                        </div>
                    </div>
                    <input type="range" id="vol" min="0" max="1" step="0.01" value="0.7" class="w-full accent-pink bg-gray-800 h-1 appearance-none cursor-pointer">
                </div>
            </div>
        </div>
    </main>

    <footer class="flex justify-between items-end border-t border-gray-900 pt-8">
        <div class="space-y-1">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Listeners Online</p>
            <p id="listener-count" class="text-2xl font-black italic">--</p>
        </div>
        <div class="text-right space-y-1">
            <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Station ID</p>
            <p class="text-lg font-bold italic">RADAR-01-GLOBAL</p>
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
                document.getElementById('playIcon').classList.remove('translate-x-1');
            } else {
                audio.pause();
                document.getElementById('playIcon').innerHTML = '<path d="M8 5v14l11-7z"/>';
                document.getElementById('playIcon').classList.add('translate-x-1');
            }
        };

        document.getElementById('vol').oninput = (e) => {
            const v = e.target.value;
            audio.volume = v;
            document.getElementById('vol-display').innerText = Math.round(v * 100) + "%";
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
    <title>RADAR // BROADCAST CONTROL</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        :root { --pink: #ff007f; --navy-black: #05070a; --purple: #8a2be2; --navy-white: #f0f0f5; }
        body { background-color: var(--navy-white); color: var(--navy-black); font-family: 'Inter', sans-serif; }
        .bg-pink { background-color: var(--pink); }
        .text-pink { color: var(--pink); }
        .sidebar { background-color: var(--navy-black); color: var(--navy-white); }
        .card { background: white; border: 2px solid var(--navy-black); box-shadow: 10px 10px 0px var(--navy-black); }
    </style>
</head>
<body class="flex h-screen overflow-hidden">
    <!-- Sidebar Nav -->
    <aside class="w-24 sidebar flex flex-col items-center py-8 justify-between border-r border-gray-800">
        <div class="text-pink font-black italic text-2xl tracking-tighter">R.</div>
        <div class="space-y-8">
            <div class="w-12 h-12 bg-pink flex items-center justify-center rounded-sm cursor-pointer">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
            </div>
            <div class="w-12 h-12 flex items-center justify-center opacity-30">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            </div>
        </div>
        <div class="text-[10px] font-black -rotate-90 origin-center whitespace-nowrap opacity-20">RADAR COMMAND v2.5</div>
    </aside>

    <main class="flex-1 overflow-y-auto p-12">
        <header class="flex justify-between items-end mb-12">
            <div>
                <h1 class="text-5xl font-black italic uppercase tracking-tighter">Broadcast Center</h1>
                <p class="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Managing Global Synchronized Stream</p>
            </div>
            <div class="flex gap-8 text-right">
                <div>
                    <div class="text-[10px] font-black text-gray-400 uppercase">Live Listeners</div>
                    <div id="stats-listeners" class="text-3xl font-black italic">--</div>
                </div>
                <div>
                    <div class="text-[10px] font-black text-gray-400 uppercase">Signal Status</div>
                    <div class="text-3xl font-black italic text-green-500">LIVE</div>
                </div>
            </div>
        </header>

        <div class="grid lg:grid-cols-3 gap-12">
            <!-- Playlist Manager -->
            <div class="lg:col-span-2 space-y-8">
                <div class="card p-8">
                    <div class="flex justify-between items-center mb-8">
                        <h2 class="text-2xl font-black uppercase italic tracking-tight">Active Audio Queue</h2>
                        <button onclick="clearAll()" class="text-[10px] font-bold border-2 border-black px-4 py-1 hover:bg-black hover:text-white transition-all uppercase">Clear Queue</button>
                    </div>
                    <div id="playlist-list" class="space-y-4">
                        <!-- Tracks -->
                    </div>
                </div>
            </div>

            <!-- Management Tools -->
            <div class="space-y-8">
                <!-- Advanced Upload -->
                <div class="bg-black text-white p-8 border-4 border-black">
                    <h2 class="text-xl font-black mb-6 uppercase text-pink italic tracking-widest">Multi-Track Upload</h2>
                    <div id="drop-zone" class="border-2 border-dashed border-gray-700 p-8 text-center hover:border-pink transition-colors cursor-pointer group">
                        <input type="file" id="file-input" multiple accept="audio/*" class="hidden">
                        <svg class="w-10 h-10 mx-auto mb-4 text-gray-600 group-hover:text-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                        <p class="text-[10px] font-bold uppercase text-gray-400">Drag files here or click to browse</p>
                    </div>
                    <div id="up-progress" class="mt-4 hidden">
                        <div class="h-1 bg-gray-800 w-full overflow-hidden">
                            <div id="up-bar" class="h-full bg-pink w-0 transition-all"></div>
                        </div>
                        <p id="up-status" class="text-[9px] uppercase font-bold mt-2 text-pink">Uploading...</p>
                    </div>
                </div>

                <!-- URL Ingest -->
                <div class="card p-8">
                    <h2 class="text-xs font-black uppercase mb-4 text-gray-400 tracking-widest">Global Stream Ingest</h2>
                    <textarea id="bulk-urls" rows="3" class="w-full bg-gray-50 border-2 border-black p-4 text-xs font-mono mb-4 focus:ring-0 outline-none" placeholder="https://url.com | TRACK NAME"></textarea>
                    <button onclick="addUrls()" class="w-full bg-black text-white py-4 font-black uppercase text-xs tracking-[0.2em] hover:bg-pink transition-all">Ingest Signals</button>
                </div>
            </div>
        </div>
    </main>

    <script>
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => uploadFiles(e.target.files);

        async function fetchState() {
            const res = await fetch('/api/status');
            const data = await res.json();
            document.getElementById('stats-listeners').innerText = data.listeners.toString().padStart(3, '0');
            
            const pRes = await fetch('/api/playlist');
            const pData = await pRes.json();
            
            const list = document.getElementById('playlist-list');
            list.innerHTML = pData.map((t, i) => \`
                <div class="flex items-center justify-between p-5 border-2 border-black hover:bg-gray-50 group \${data.currentTrackIndex === i ? 'bg-pink/5 border-pink' : ''}">
                    <div class="flex items-center gap-4">
                        <span class="text-sm font-black \${data.currentTrackIndex === i ? 'text-pink' : 'text-gray-300'}">\${(i+1).toString().padStart(2, '0')}</span>
                        <div>
                            <div class="font-black uppercase text-sm italic">\${t.title}</div>
                            <div class="text-[9px] font-bold text-gray-400 uppercase">\${t.isLocal ? 'FILE' : 'EXTERNAL'}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                         \${data.currentTrackIndex === i ? 
                            '<span class="text-[9px] font-black bg-pink text-white px-3 py-1 uppercase italic">On Air</span>' : 
                            \`<button onclick="playNow(\${i})" class="text-[9px] font-black bg-black text-white px-3 py-1 uppercase italic hover:bg-pink transition-all">Go Live</button>\`}
                        <button onclick="deleteTrack(\${i})" class="text-[9px] font-black border border-black px-2 py-1 hover:bg-red-500 hover:text-white transition-all">X</button>
                    </div>
                </div>
            \`).join('');
        }

        async function uploadFiles(files) {
            if(!files.length) return;
            const progress = document.getElementById('up-progress');
            const bar = document.getElementById('up-bar');
            const status = document.getElementById('up-status');
            
            progress.classList.remove('hidden');
            status.innerText = "Processing Transmission...";
            
            const fd = new FormData();
            for(let f of files) fd.append('audioFiles', f);
            
            try {
                bar.style.width = '30%';
                await fetch('/api/upload', { method: 'POST', body: fd });
                bar.style.width = '100%';
                status.innerText = "Signals Locked.";
                setTimeout(() => {
                    progress.classList.add('hidden');
                    bar.style.width = '0%';
                }, 2000);
                fetchState();
            } catch(e) {
                status.innerText = "Upload Error.";
            }
        }

        async function addUrls() {
            const text = document.getElementById('bulk-urls').value;
            if(!text.trim()) return;
            const lines = text.split('\\n').filter(l => l.trim());
            const tracks = lines.map(l => {
                const [url, title] = l.split('|').map(s => s.trim());
                return { url, title: title || "Remote Signal", isLocal: false };
            });
            await fetch('/api/playlist/bulk', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tracks })
            });
            document.getElementById('bulk-urls').value = '';
            fetchState();
        }

        async function playNow(i) {
            await fetch('/api/broadcast/play/' + i, { method: 'POST' });
            fetchState();
        }

        async function deleteTrack(i) {
            await fetch('/api/playlist/delete/' + i, { method: 'POST' });
            fetchState();
        }

        async function clearAll() {
            if(!confirm("WIPE ENTIRE QUEUE?")) return;
            await fetch('/api/playlist/clear', { method: 'POST' });
            fetchState();
        }

        fetchState();
        setInterval(fetchState, 5000);
    </script>
</body>
</html>
`;

// --- SERVER LOGIC ---

app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));

app.post('/api/upload', upload.array('audioFiles'), (req, res) => {
    const newTracks = req.files.map(f => ({
        id: Math.random().toString(36).substr(2, 9),
        title: f.originalname.replace(/\\.[^/.]+$/, "").toUpperCase(),
        url: \`/uploads/\${f.filename}\`,
        isLocal: true,
        path: f.path
    }));
    playlist = [...playlist, ...newTracks];
    res.json({ success: true, count: newTracks.length });
});

app.get('/api/playlist', (req, res) => res.json(playlist));

app.post('/api/playlist/bulk', (req, res) => {
    const tracksWithIds = req.body.tracks.map(t => ({ ...t, id: Math.random().toString(36).substr(2, 9) }));
    playlist = [...playlist, ...tracksWithIds];
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
        if (broadcastStatus.currentTrackIndex >= playlist.length) {
            broadcastStatus.currentTrackIndex = 0;
        }
    }
    res.json({ success: true });
});

app.post('/api/playlist/clear', (req, res) => {
    playlist.forEach(t => {
        if(t.isLocal && fs.existsSync(t.path)) fs.unlinkSync(t.path);
    });
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

app.get('/api/status', (req, res) => {
    if (playlist.length > 0 && broadcastStatus.nowPlaying === "STATION ONLINE") {
        broadcastStatus.nowPlaying = playlist[broadcastStatus.currentTrackIndex].title;
    }
    res.json(broadcastStatus);
});

app.get('/stream', async (req, res) => {
    try {
        const track = playlist[broadcastStatus.currentTrackIndex];
        if (!track) return res.status(404).send("Silence");

        if (track.isLocal) {
            if (fs.existsSync(track.path)) {
                res.setHeader('Content-Type', 'audio/mpeg');
                fs.createReadStream(track.path).pipe(res);
            } else {
                res.status(404).send("File missing");
            }
        } else {
            const response = await axios({ method: 'get', url: track.url, responseType: 'stream', timeout: 10000 });
            res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
            response.data.pipe(res);
        }
    } catch (e) {
        res.status(500).send("Signal Error");
    }
});

app.listen(PORT, () => console.log('Radar active on port ' + PORT));