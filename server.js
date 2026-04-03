const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists with absolute path
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Remove special characters from filename to prevent path errors
        const safeName = file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        cb(null, Date.now() + '-' + safeName);
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit per file
});

// Global state
let playlist = [
    { title: "System Initializing...", url: "https://radar-dance-radio.onrender.com/", isLocal: false }
];

let broadcastStatus = {
    nowPlaying: "RADAR ONLINE",
    currentTrackIndex: 0,
    startTime: Date.now()
};

app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// --- LISTENER UI ---
const listenerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RADAR // LIVE</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #05070a; color: #f0f0f5; font-family: 'Inter', sans-serif; overflow: hidden; }
        .text-pink { color: #ff007f; }
        .bg-pink { background-color: #ff007f; }
    </style>
</head>
<body class="h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
        <div class="space-y-6">
            <div class="inline-flex items-center gap-2 px-3 py-1 border border-[#ff007f] text-[#ff007f] text-[10px] font-bold tracking-[0.4em] uppercase">Live Signal</div>
            <h1 class="text-8xl font-black tracking-tighter uppercase italic leading-none">Radar<span class="text-pink">.</span></h1>
            <p class="text-gray-500 font-bold uppercase text-xs tracking-[0.3em]">High-Fidelity Dance Radio</p>
        </div>
        <div class="bg-[#0a0c12] border border-gray-800 p-10 rounded-sm relative">
            <div class="mb-12">
                <div class="text-[10px] uppercase text-gray-600 mb-2 tracking-widest font-bold">Metadata</div>
                <div id="track-title" class="text-3xl font-black truncate text-white uppercase italic">...</div>
            </div>
            <div class="flex items-center gap-8">
                <button id="playBtn" class="bg-pink text-white w-24 h-24 flex items-center justify-center shadow-lg hover:bg-white hover:text-black transition-colors">
                    <svg id="playIcon" class="w-10 h-10 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <div class="flex-1">
                    <input type="range" id="vol" class="w-full accent-pink h-1 bg-gray-800 appearance-none cursor-pointer" min="0" max="1" step="0.01" value="0.7">
                </div>
            </div>
        </div>
    </div>
    <audio id="audio" crossOrigin="anonymous"></audio>
    <script>
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const trackTitle = document.getElementById('track-title');
        let currentStart = 0;

        async function sync() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                trackTitle.innerText = data.nowPlaying;
                if(currentStart !== data.startTime) {
                    currentStart = data.startTime;
                    const playing = !audio.paused;
                    audio.src = "/stream?t=" + data.startTime;
                    if(playing) {
                        audio.load();
                        audio.play().catch(e => console.log("Autoplay blocked"));
                    }
                }
            } catch(e) { console.error("Sync error"); }
        }
        setInterval(sync, 3000);
        sync();

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
        document.getElementById('vol').oninput = (e) => audio.volume = e.target.value;
    </script>
</body>
</html>
`;

// --- ADMIN UI ---
const adminHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>RADAR // ADMIN</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #f0f0f5; color: #05070a; font-family: 'Inter', sans-serif; }
        .btn-pink { background-color: #ff007f; color: white; }
        .btn-pink:hover { background-color: #000; color: #ff007f; }
    </style>
</head>
<body class="p-8 md:p-16">
    <div class="max-w-6xl mx-auto">
        <header class="flex justify-between items-end mb-12 border-b-8 border-black pb-6">
            <h1 class="text-6xl font-black italic uppercase tracking-tighter leading-none">Radar<span class="text-[#ff007f]">.</span> Admin</h1>
            <div class="text-right font-bold text-[10px] uppercase tracking-widest text-gray-400">Station Control Unit</div>
        </header>

        <div class="grid lg:grid-cols-3 gap-12">
            <!-- Playlist -->
            <div class="lg:col-span-2">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-black uppercase italic">Broadcast Queue</h2>
                    <button onclick="clearPlaylist()" class="text-[10px] font-bold border-2 border-black px-4 py-1 hover:bg-black hover:text-white transition-all">CLEAR ALL</button>
                </div>
                <div id="playlist-container" class="bg-white border-4 border-black shadow-[12px_12px_0px_#ff007f] min-h-[400px]">
                    <!-- Playlist Items Injection -->
                </div>
            </div>

            <!-- Sidebar Controls -->
            <div class="space-y-8">
                <!-- FILE UPLOAD BLOCK -->
                <div class="bg-black text-white p-8">
                    <h2 class="text-xl font-black mb-4 uppercase text-[#ff007f] italic">Upload Local Files</h2>
                    <p class="text-[10px] text-gray-500 mb-4 uppercase font-bold">Select MP3/WAV files for the station</p>
                    
                    <div class="mb-4">
                        <input type="file" id="file-input" multiple accept="audio/*" class="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:bg-[#ff007f] file:text-white file:border-0 file:font-black file:uppercase file:cursor-pointer">
                    </div>
                    
                    <button id="upload-btn-action" onclick="uploadFiles()" class="w-full btn-pink py-4 font-black uppercase text-xs tracking-widest transition-all">
                        Upload & Sync
                    </button>
                    
                    <div id="up-status" class="mt-4 text-[10px] uppercase font-bold text-[#ff007f]"></div>
                </div>

                <!-- URL INGEST BLOCK -->
                <div class="border-4 border-black p-8 bg-white">
                    <h2 class="text-xs font-black uppercase mb-4 text-gray-400">Add Stream URLs</h2>
                    <textarea id="bulk-input" rows="3" class="w-full border-2 border-gray-200 p-4 text-xs mb-4 outline-none focus:border-[#ff007f]" placeholder="URL | Title"></textarea>
                    <button onclick="bulkAdd()" class="w-full bg-black text-white py-3 font-black uppercase text-xs hover:bg-[#ff007f] transition-colors">Add to Queue</button>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        async function fetchPlaylist() {
            try {
                const res = await fetch('/api/playlist');
                const data = await res.json();
                const container = document.getElementById('playlist-container');
                
                if(data.length === 0) {
                    container.innerHTML = '<div class="p-10 text-center text-gray-300 font-bold uppercase italic">Queue Empty</div>';
                    return;
                }

                container.innerHTML = data.map((t, i) => \`
                    <div class="p-6 border-b-2 border-black flex justify-between items-center hover:bg-gray-50">
                        <div>
                            <div class="font-black uppercase text-lg">\${t.title}</div>
                            <div class="text-[9px] font-bold text-gray-400 uppercase">\${t.isLocal ? 'FILE' : 'STREAM'}</div>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="playTrack(\${i})" class="bg-black text-white px-5 py-2 font-black text-[10px] uppercase italic hover:bg-[#ff007f] transition-colors">Go Live</button>
                            <button onclick="deleteTrack(\${i})" class="border border-black px-3 py-2 font-black text-[10px] hover:bg-red-500 hover:text-white transition-colors">X</button>
                        </div>
                    </div>
                \`).join('');
            } catch(e) { console.error("Fetch failed"); }
        }

        async function uploadFiles() {
            const input = document.getElementById('file-input');
            const btn = document.getElementById('upload-btn-action');
            const status = document.getElementById('up-status');
            
            if(!input.files.length) {
                status.innerText = "No files selected";
                return;
            }

            status.innerText = "UPLOADING TRANSMISSION...";
            btn.disabled = true;
            btn.style.opacity = '0.5';
            
            const fd = new FormData();
            for(let f of input.files) fd.append('audioFiles', f);
            
            try {
                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                if(res.ok) {
                    status.innerText = "SIGNAL BROADCASTED SUCCESSFULLY.";
                    input.value = '';
                    fetchPlaylist();
                } else {
                    status.innerText = "UPLOAD FAILED.";
                }
            } catch(e) {
                status.innerText = "CONNECTION ERROR.";
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
                setTimeout(() => status.innerText = "", 5000);
            }
        }

        async function bulkAdd() {
            const input = document.getElementById('bulk-input').value;
            if(!input.trim()) return;
            const lines = input.split('\\n').filter(l => l.trim());
            const tracks = lines.map(l => {
                const parts = l.split('|');
                const url = parts[0].trim();
                const title = parts[1] ? parts[1].trim() : "Remote Stream";
                return { url, title, isLocal: false };
            });
            await fetch('/api/playlist/bulk', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tracks })
            });
            document.getElementById('bulk-input').value = '';
            fetchPlaylist();
        }

        async function playTrack(i) {
            await fetch('/api/broadcast/play/' + i, { method: 'POST' });
        }

        async function deleteTrack(i) {
            await fetch('/api/playlist/delete/' + i, { method: 'POST' });
            fetchPlaylist();
        }

        async function clearPlaylist() {
            if(!confirm("WIPE ENTIRE QUEUE?")) return;
            await fetch('/api/playlist/clear', { method: 'POST' });
            fetchPlaylist();
        }

        fetchPlaylist();
        setInterval(fetchPlaylist, 5000);
    </script>
</body>
</html>
`;

// --- API ROUTES ---
app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));

app.post('/api/upload', upload.array('audioFiles'), (req, res) => {
    try {
        const newTracks = req.files.map(f => ({
            title: f.originalname.replace(/\\.[^/.]+$/, "").toUpperCase(),
            url: \`/uploads/\${f.filename}\`,
            isLocal: true,
            path: f.path
        }));
        playlist = [...playlist, ...newTracks];
        res.json({ success: true, count: newTracks.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/playlist', (req, res) => res.json(playlist));

app.post('/api/playlist/bulk', (req, res) => {
    playlist = [...playlist, ...req.body.tracks];
    res.json({ success: true });
});

app.post('/api/playlist/delete/:index', (req, res) => {
    const i = parseInt(req.params.index);
    if(i >= 0 && i < playlist.length) {
        const track = playlist[i];
        if(track.isLocal && track.path && fs.existsSync(track.path)) {
            try { fs.unlinkSync(track.path); } catch(e) {}
        }
        playlist.splice(i, 1);
    }
    res.json({ success: true });
});

app.post('/api/playlist/clear', (req, res) => {
    playlist.forEach(track => {
        if(track.isLocal && track.path && fs.existsSync(track.path)) {
            try { fs.unlinkSync(track.path); } catch(e) {}
        }
    });
    playlist = [];
    res.json({ success: true });
});

app.post('/api/broadcast/play/:index', (req, res) => {
    const i = parseInt(req.params.index);
    if(playlist[i]) {
        broadcastStatus.currentTrackIndex = i;
        broadcastStatus.nowPlaying = playlist[i].title;
        broadcastStatus.startTime = Date.now();
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Track not found" });
    }
});

app.get('/api/status', (req, res) => res.json(broadcastStatus));

app.get('/stream', async (req, res) => {
    try {
        const track = playlist[broadcastStatus.currentTrackIndex];
        if(!track) return res.status(404).send("No track");

        if(track.isLocal) {
            if(fs.existsSync(track.path)) {
                res.setHeader('Content-Type', 'audio/mpeg');
                fs.createReadStream(track.path).pipe(res);
            } else {
                res.status(404).send("File missing");
            }
        } else {
            const response = await axios({ 
                method: 'get', 
                url: track.url, 
                responseType: 'stream',
                timeout: 10000 
            });
            res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
            response.data.pipe(res);
        }
    } catch(e) { 
        console.error("Stream Error:", e.message);
        res.status(500).send("Signal Lost"); 
    }
});

app.listen(PORT, () => console.log('Radar active on port ' + PORT));