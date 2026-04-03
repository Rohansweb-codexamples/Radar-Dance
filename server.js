const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Global state for the broadcast
let broadcastStatus = {
    nowPlaying: "STATION INITIALIZING",
    currentTrackIndex: 0,
    isPlaying: false,
    theme: {
        bg: "#05070a", // Navy Black
        accent: "#ff007f", // Pink
        secondary: "#8a2be2", // Purple
        text: "#f0f0f5" // Navy White
    }
};

// In-memory Playlist
let playlist = [
    { title: "System Test Signal", url: "https://radar-dance-radio.onrender.com" }
];

app.use(express.json());

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
                <span class="w-2 h-2 bg-pink animate-pulse rounded-full"></span> Live Transmission
            </div>
            <h1 class="text-8xl font-black tracking-tighter uppercase italic leading-none">Radar<span class="text-pink">.</span></h1>
            <p class="text-gray-500 font-bold uppercase text-xs tracking-[0.3em]">Premium High-Fidelity Dance Signal</p>
        </div>

        <div class="bg-[#0a0c12] border border-gray-800 p-10 glow-purple rounded-sm relative overflow-hidden">
            <div class="absolute top-0 left-0 w-1 h-full bg-pink"></div>
            <div class="mb-12">
                <div class="text-[10px] uppercase text-gray-600 mb-2 tracking-widest font-bold">Frequency Data</div>
                <div id="track-title" class="text-3xl font-black truncate text-white uppercase tracking-tight italic">...</div>
            </div>

            <div class="flex items-center gap-8">
                <button id="playBtn" class="bg-pink hover:bg-white text-white hover:text-black w-24 h-24 flex items-center justify-center transition-all shadow-lg group">
                    <svg id="playIcon" class="w-10 h-10 fill-current translate-x-1" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <div class="flex-1">
                    <div class="flex justify-between text-[10px] text-gray-500 mb-3 font-bold uppercase tracking-tighter">
                        <span>Master Gain</span>
                        <span id="vol-val">70%</span>
                    </div>
                    <input type="range" id="vol" class="w-full accent-pink h-1 bg-gray-800 appearance-none cursor-pointer" min="0" max="1" step="0.01" value="0.7">
                </div>
            </div>
        </div>
    </div>

    <audio id="audio" crossOrigin="anonymous" src="/stream"></audio>

    <script>
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const trackTitle = document.getElementById('track-title');
        
        async function sync() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                if (trackTitle.innerText !== data.nowPlaying) {
                    trackTitle.innerText = data.nowPlaying;
                    // If audio was already playing and the source changed on server, we might need a subtle reload
                    // But usually, the /stream proxy handles the transition
                }
            } catch(e) {}
        }

        setInterval(sync, 2000);
        sync();

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
            document.getElementById('vol-val').innerText = Math.round(e.target.value * 100) + "%";
        };

        // Auto-advance visualization logic
        audio.onended = () => {
             fetch('/api/broadcast/next', { method: 'POST' });
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
    <title>RADAR // COMMAND</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #f0f0f5; color: #05070a; font-family: 'Inter', sans-serif; }
        .bg-navy-black { background-color: #05070a; }
        .text-pink { color: #ff007f; }
        .btn-pink { background-color: #ff007f; color: white; }
    </style>
</head>
<body class="p-8 md:p-16">
    <div class="max-w-6xl mx-auto">
        <header class="flex justify-between items-end mb-12 border-b-8 border-black pb-6">
            <div>
                <h1 class="text-6xl font-black italic uppercase tracking-tighter leading-none">Radar<span class="text-pink">.</span></h1>
                <p class="text-[10px] font-bold tracking-[0.4em] text-gray-500 uppercase mt-2">Broadcast Control Unit</p>
            </div>
            <div class="text-right hidden md:block">
                <div class="text-[10px] font-bold uppercase text-gray-400">Signal Status</div>
                <div class="text-2xl font-black text-green-600">ENCRYPTED // LIVE</div>
            </div>
        </header>

        <div class="grid lg:grid-cols-3 gap-12">
            <!-- Playlist Manager -->
            <div class="lg:col-span-2">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-black uppercase tracking-tight italic">Active Queue</h2>
                    <button onclick="clearPlaylist()" class="text-[10px] font-bold border-2 border-black px-4 py-1 hover:bg-black hover:text-white transition-all uppercase">Flush System</button>
                </div>
                <div id="playlist-container" class="bg-white border-4 border-black shadow-[12px_12px_0px_#ff007f] min-h-[400px]">
                    <!-- Tracks -->
                </div>
            </div>

            <!-- Upload / Input -->
            <div class="space-y-8">
                <div class="bg-black text-white p-8 shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                    <h2 class="text-xl font-black mb-6 uppercase text-pink italic tracking-widest">Bulk Ingest</h2>
                    <p class="text-[9px] text-gray-400 mb-4 uppercase leading-tight font-bold">Enter multiple stream URLs (one per line). Format: URL | Title</p>
                    <textarea id="bulk-input" rows="8" class="w-full bg-[#111] border-none p-4 text-xs font-mono text-pink mb-4 focus:ring-1 focus:ring-pink outline-none" placeholder="https://stream.com/live | Night Dance&#10;https://file.mp3 | Bass Mix"></textarea>
                    <button onclick="bulkAdd()" class="w-full btn-pink py-4 font-black uppercase text-xs tracking-[0.2em] hover:bg-white hover:text-black transition-all">Add to Playlist</button>
                </div>

                <div class="border-4 border-black p-8 bg-white">
                    <h2 class="text-xs font-black uppercase mb-4 tracking-widest text-gray-400">Global Controls</h2>
                    <div class="grid grid-cols-1 gap-3">
                        <button onclick="nextTrack()" class="w-full bg-black text-white py-4 text-xs font-black uppercase tracking-widest hover:bg-pink transition-all italic">Force Next Track</button>
                        <button onclick="resetIndex()" class="w-full border-2 border-black py-3 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all">Reset to Track 01</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function fetchPlaylist() {
            const res = await fetch('/api/playlist');
            const data = await res.json();
            const container = document.getElementById('playlist-container');
            
            if(data.length === 0) {
                container.innerHTML = '<div class="p-20 text-center text-gray-300 font-black uppercase tracking-widest italic">No Signal Found</div>';
                return;
            }

            container.innerHTML = data.map((track, i) => \`
                <div class="p-6 border-b-2 border-black flex justify-between items-center group hover:bg-gray-50">
                    <div class="flex items-center gap-6">
                        <span class="text-xl font-black text-gray-200 group-hover:text-pink transition-colors">\${(i+1).toString().padStart(2, '0')}</span>
                        <div>
                            <div class="font-black uppercase text-lg leading-tight">\${track.title}</div>
                            <div class="text-[9px] text-gray-400 truncate max-w-xs font-mono">\${track.url}</div>
                        </div>
                    </div>
                    <div class="flex gap-2">
                         <button onclick="playTrack(\${i})" class="text-[10px] font-black bg-black text-white px-5 py-2 hover:bg-pink transition-all uppercase italic">Go Live</button>
                         <button onclick="removeTrack(\${i})" class="text-[10px] font-black border border-black px-3 py-2 hover:bg-red-500 hover:text-white transition-all uppercase">X</button>
                    </div>
                </div>
            \`).join('');
        }

        async function bulkAdd() {
            const input = document.getElementById('bulk-input').value;
            if(!input.trim()) return;

            const lines = input.split('\\n').filter(l => l.trim());
            const tracks = lines.map(line => {
                const [url, title] = line.split('|').map(s => s.trim());
                return { url, title: title || "Unknown Signal" };
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

        async function removeTrack(index) {
            await fetch('/api/playlist/remove/' + index, { method: 'POST' });
            fetchPlaylist();
        }

        async function nextTrack() {
            await fetch('/api/broadcast/next', { method: 'POST' });
            fetchPlaylist();
        }

        async function clearPlaylist() {
            if(!confirm("WIPE ENTIRE PLAYLIST?")) return;
            await fetch('/api/playlist/clear', { method: 'POST' });
            fetchPlaylist();
        }

        async function resetIndex() {
            await fetch('/api/broadcast/play/0', { method: 'POST' });
        }

        fetchPlaylist();
        setInterval(fetchPlaylist, 4000);
    </script>
</body>
</html>
`;

// --- EXPRESS LOGIC ---

app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));

// Playlist APIs
app.get('/api/playlist', (req, res) => res.json(playlist));

app.post('/api/playlist/bulk', (req, res) => {
    const { tracks } = req.body;
    if (Array.isArray(tracks)) {
        playlist = [...playlist, ...tracks];
        res.json({ success: true, count: tracks.length });
    } else {
        res.status(400).json({ error: "Invalid data" });
    }
});

app.post('/api/playlist/remove/:index', (req, res) => {
    const index = parseInt(req.params.index);
    if (index > -1 && index < playlist.length) {
        playlist.splice(index, 1);
        res.json({ success: true });
    }
});

app.post('/api/playlist/clear', (req, res) => {
    playlist = [];
    broadcastStatus.nowPlaying = "SIGNAL LOST";
    res.json({ success: true });
});

// Broadcast Control APIs
app.post('/api/broadcast/play/:index', (req, res) => {
    const index = parseInt(req.params.index);
    if (playlist[index]) {
        broadcastStatus.currentTrackIndex = index;
        broadcastStatus.nowPlaying = playlist[index].title;
        res.json({ success: true });
    }
});

app.post('/api/broadcast/next', (req, res) => {
    if (playlist.length > 0) {
        broadcastStatus.currentTrackIndex = (broadcastStatus.currentTrackIndex + 1) % playlist.length;
        broadcastStatus.nowPlaying = playlist[broadcastStatus.currentTrackIndex].title;
        res.json({ success: true, next: broadcastStatus.nowPlaying });
    } else {
        res.status(404).json({ error: "Empty playlist" });
    }
});

app.get('/api/status', (req, res) => {
    if (playlist.length > 0 && (broadcastStatus.nowPlaying === "STATION INITIALIZING" || broadcastStatus.nowPlaying === "SIGNAL LOST")) {
        broadcastStatus.nowPlaying = playlist[broadcastStatus.currentTrackIndex].title;
    }
    res.json(broadcastStatus);
});

// Audio Stream Proxy
app.get('/stream', async (req, res) => {
    try {
        const currentTrack = playlist[broadcastStatus.currentTrackIndex];
        if (!currentTrack) return res.status(404).send("No track loaded");

        const response = await axios({
            method: 'get',
            url: currentTrack.url,
            responseType: 'stream',
            timeout: 15000
        });

        res.set({
            'Content-Type': response.headers['content-type'] || 'audio/mpeg',
            'Transfer-Encoding': 'chunked'
        });

        response.data.pipe(res);
    } catch (error) {
        console.error("Stream error:", error.message);
        res.status(500).send('Radio Signal Lost');
    }
});

app.listen(PORT, () => {
    console.log(`Radar Station Active on port ${PORT}`);
});