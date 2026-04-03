const express = require('express');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

// Configure storage for uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// Global state for the broadcast
let broadcastStatus = {
    nowPlaying: "STATION INITIALIZING",
    currentTrackIndex: 0,
    isPlaying: false,
    startTime: Date.now(), // Used for global sync
    theme: {
        bg: "#05070a", // Navy Black
        accent: "#ff007f", // Pink
        secondary: "#8a2be2", // Purple
        text: "#f0f0f5" // Navy White
    }
};

// In-memory Playlist
let playlist = [
    { title: "System Test Signal", url: "https://radar-dance-radio.onrender.com/", isLocal: false }
];

app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// --- LISTENER UI (Root Route '/') ---
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
        .border-pink { border-color: #ff007f; }
        .bg-pink { background-color: #ff007f; }
        .glow-purple { box-shadow: 0 0 40px rgba(138, 43, 226, 0.15); }
    </style>
</head>
<body class="h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
        <div class="space-y-6">
            <div class="inline-flex items-center gap-2 px-3 py-1 border border-pink text-pink text-[10px] font-bold tracking-[0.4em] uppercase">
                <span class="w-2 h-2 bg-pink animate-pulse rounded-full"></span> Synchronized Signal
            </div>
            <h1 class="text-8xl font-black tracking-tighter uppercase italic leading-none">Radar<span class="text-pink">.</span></h1>
            <p class="text-gray-500 font-bold uppercase text-xs tracking-[0.3em]">Global Sync // Real-Time Broadcast</p>
        </div>

        <div class="bg-[#0a0c12] border border-gray-800 p-10 glow-purple rounded-sm relative overflow-hidden">
            <div class="absolute top-0 left-0 w-1 h-full bg-pink"></div>
            <div class="mb-12">
                <div class="text-[10px] uppercase text-gray-600 mb-2 tracking-widest font-bold">Live Metadata</div>
                <div id="track-title" class="text-3xl font-black truncate text-white uppercase tracking-tight italic">...</div>
            </div>

            <div class="flex items-center gap-8">
                <button id="playBtn" class="bg-pink hover:bg-white text-white hover:text-black w-24 h-24 flex items-center justify-center transition-all shadow-lg group">
                    <svg id="playIcon" class="w-10 h-10 fill-current translate-x-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <div class="flex-1">
                    <div class="flex justify-between text-[10px] text-gray-500 mb-3 font-bold uppercase tracking-tighter">
                        <span>Output Level</span>
                        <span id="vol-val">70%</span>
                    </div>
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
        let currentUrl = "";
        
        async function sync() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                
                if (trackTitle.innerText !== data.nowPlaying) {
                    trackTitle.innerText = data.nowPlaying;
                    // Reset stream if track changed
                    if(currentUrl !== "/stream?t=" + data.startTime) {
                        currentUrl = "/stream?t=" + data.startTime;
                        const wasPlaying = !audio.paused;
                        audio.src = currentUrl;
                        if(wasPlaying) audio.play();
                    }
                }
            } catch(e) {}
        }

        setInterval(sync, 2000);
        sync();

        playBtn.onclick = () => {
            if (!audio.src) audio.src = "/stream?t=" + Date.now();
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
            document.getElementById('vol-val').innerText = Math.round(e.target.value * 100) + "%";
        };
    </script>
</body>
</html>
`;

// --- ADMIN UI ---
const adminHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>RADAR // COMMAND</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #f0f0f5; color: #05070a; font-family: 'Inter', sans-serif; }
        .text-pink { color: #ff007f; }
        .btn-pink { background-color: #ff007f; color: white; }
    </style>
</head>
<body class="p-8 md:p-16">
    <div class="max-w-6xl mx-auto">
        <header class="flex justify-between items-end mb-12 border-b-8 border-black pb-6">
            <div>
                <h1 class="text-6xl font-black italic uppercase tracking-tighter leading-none">Radar<span class="text-pink">.</span></h1>
                <p class="text-[10px] font-bold tracking-[0.4em] text-gray-500 uppercase mt-2">Central Broadcast Unit</p>
            </div>
            <div class="text-right">
                <div class="text-[10px] font-bold uppercase text-gray-400">Server Sync</div>
                <div id="server-time" class="text-xl font-black font-mono">00:00:00</div>
            </div>
        </header>

        <div class="grid lg:grid-cols-3 gap-12">
            <div class="lg:col-span-2">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-black uppercase tracking-tight italic">Active Queue</h2>
                    <button onclick="clearPlaylist()" class="text-[10px] font-bold border-2 border-black px-4 py-1 hover:bg-black hover:text-white transition-all uppercase">Flush</button>
                </div>
                <div id="playlist-container" class="bg-white border-4 border-black shadow-[12px_12px_0px_#ff007f] min-h-[400px]"></div>
            </div>

            <div class="space-y-8">
                <!-- File Upload -->
                <div class="bg-black text-white p-8">
                    <h2 class="text-xl font-black mb-4 uppercase text-pink italic tracking-widest">Upload Files</h2>
                    <input type="file" id="file-input" multiple class="block w-full text-xs text-gray-400 mb-4 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-black file:bg-pink file:text-white hover:file:bg-white hover:file:text-black">
                    <button id="upload-btn" onclick="uploadFiles()" class="w-full btn-pink py-4 font-black uppercase text-xs tracking-[0.2em] hover:bg-white hover:text-black transition-all">Start Upload</button>
                    <div id="upload-status" class="mt-2 text-[9px] uppercase font-bold text-gray-500"></div>
                </div>

                <!-- URL Ingest -->
                <div class="border-4 border-black p-8 bg-white">
                    <h2 class="text-xs font-black uppercase mb-4 tracking-widest text-gray-400">URL Ingest</h2>
                    <textarea id="bulk-input" rows="4" class="w-full border-2 border-gray-200 p-4 text-xs font-mono mb-4 focus:border-pink outline-none" placeholder="URL | Title"></textarea>
                    <button onclick="bulkAdd()" class="w-full bg-black text-white py-3 font-black uppercase text-xs tracking-widest hover:bg-pink transition-all">Add URLs</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function uploadFiles() {
            const input = document.getElementById('file-input');
            const status = document.getElementById('upload-status');
            if(!input.files.length) return;

            status.innerText = "Processing Transmission...";
            const formData = new FormData();
            for(let file of input.files) {
                formData.append('audioFiles', file);
            }

            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                status.innerText = "Upload Complete: " + data.count + " Signals Added";
                input.value = '';
                fetchPlaylist();
            } catch(e) {
                status.innerText = "Upload Error";
            }
        }

        async function fetchPlaylist() {
            const res = await fetch('/api/playlist');
            const data = await res.json();
            const container = document.getElementById('playlist-container');
            
            container.innerHTML = data.map((track, i) => \`
                <div class="p-6 border-b-2 border-black flex justify-between items-center group hover:bg-gray-50">
                    <div class="flex items-center gap-6">
                        <span class="text-xl font-black text-gray-200 group-hover:text-pink transition-colors">\${(i+1).toString().padStart(2, '0')}</span>
                        <div>
                            <div class="font-black uppercase text-lg leading-tight">\${track.title}</div>
                            <div class="text-[9px] text-gray-400 uppercase font-bold">\${track.isLocal ? 'Uploaded File' : 'Remote Stream'}</div>
                        </div>
                    </div>
                    <button onclick="playTrack(\${i})" class="text-[10px] font-black bg-black text-white px-5 py-2 hover:bg-pink transition-all uppercase italic">Set Live</button>
                </div>
            \`).join('');
        }

        async function bulkAdd() {
            const input = document.getElementById('bulk-input').value;
            const lines = input.split('\\n').filter(l => l.trim());
            const tracks = lines.map(line => {
                const [url, title] = line.split('|').map(s => s.trim());
                return { url, title: title || "Remote Signal", isLocal: false };
            });
            await fetch('/api/playlist/bulk', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ tracks })
            });
            document.getElementById('bulk-input').value = "";
            fetchPlaylist();
        }

        async function playTrack(index) {
            await fetch('/api/broadcast/play/' + index, { method: 'POST' });
            fetchPlaylist();
        }

        async function clearPlaylist() {
            if(!confirm("FLUSH ALL SIGNALS?")) return;
            await fetch('/api/playlist/clear', { method: 'POST' });
            fetchPlaylist();
        }

        setInterval(() => {
            const now = new Date();
            document.getElementById('server-time').innerText = now.toTimeString().split(' ')[0];
        }, 1000);

        fetchPlaylist();
    </script>
</body>
</html>
`;

// --- EXPRESS LOGIC ---

app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));

// Handle File Uploads
app.post('/api/upload', upload.array('audioFiles'), (req, res) => {
    const newTracks = req.files.map(file => ({
        title: file.originalname.replace(/\\.[^/.]+$/, ""),
        url: \`/uploads/\${file.filename}\`,
        isLocal: true,
        path: file.path
    }));
    playlist = [...playlist, ...newTracks];
    res.json({ success: true, count: newTracks.length });
});

app.get('/api/playlist', (req, res) => res.json(playlist));

app.post('/api/playlist/bulk', (req, res) => {
    const { tracks } = req.body;
    playlist = [...playlist, ...tracks];
    res.json({ success: true });
});

app.post('/api/playlist/clear', (req, res) => {
    playlist = [];
    broadcastStatus.nowPlaying = "SIGNAL LOST";
    res.json({ success: true });
});

app.post('/api/broadcast/play/:index', (req, res) => {
    const index = parseInt(req.params.index);
    if (playlist[index]) {
        broadcastStatus.currentTrackIndex = index;
        broadcastStatus.nowPlaying = playlist[index].title;
        broadcastStatus.startTime = Date.now(); // Reset sync timer for the new track
        res.json({ success: true });
    }
});

app.get('/api/status', (req, res) => {
    if (playlist.length > 0 && broadcastStatus.nowPlaying === "STATION INITIALIZING") {
        broadcastStatus.nowPlaying = playlist[broadcastStatus.currentTrackIndex].title;
    }
    res.json(broadcastStatus);
});

// Audio Stream Proxy with Global Sync
app.get('/stream', async (req, res) => {
    try {
        const track = playlist[broadcastStatus.currentTrackIndex];
        if (!track) return res.status(404).send("No signal");

        // Calculate offset (how many seconds into the song we are)
        const offsetSeconds = Math.max(0, (Date.now() - broadcastStatus.startTime) / 1000);

        if (track.isLocal) {
            // For uploaded files, we read from the file system
            const filePath = track.path;
            const stat = fs.statSync(filePath);
            const fileSize = stat.size;
            
            // Note: Simple stream without byte-range seeking for global sync is tricky.
            // In a professional setup, we would use FFmpeg to stream.
            // Here, we'll pipe the file. If it's a local file, we just stream it.
            const stream = fs.createReadStream(filePath);
            res.setHeader('Content-Type', 'audio/mpeg');
            stream.pipe(res);
        } else {
            // For remote streams
            const response = await axios({
                method: 'get',
                url: track.url,
                responseType: 'stream',
                timeout: 15000
            });
            res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
            response.data.pipe(res);
        }
    } catch (e) {
        res.status(500).send("Signal Lost");
    }
});

app.listen(PORT, () => console.log(`Radar active on port ${PORT}`));