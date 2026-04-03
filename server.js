const express = require('express');
const axios = require('axios');
const app = express();

const PORT = process.env.PORT || 3000;

// Global state for the broadcast
let broadcastStatus = {
    nowPlaying: "STATION OFFLINE",
    currentTrackIndex: 0,
    isPlaying: false,
    theme: {
        bg: "#05070a", // Navy Black
        accent: "#ff007f", // Pink
        secondary: "#8a2be2", // Purple
        text: "#f0f0f5" // Navy White
    }
};

// Simple In-Memory Playlist
let playlist = [
    { title: "Radar Welcome Signal", url: "https://radar-dance-radio.onrender.com/" }
];

app.use(express.json());

// --- LISTENER UI (Root Route '/') ---
const listenerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RADAR // PROFESSIONAL DANCE RADIO</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #05070a; color: #f0f0f5; font-family: 'Inter', sans-serif; }
        .border-pink { border-color: #ff007f; }
        .text-pink { color: #ff007f; }
        .bg-navy-white { background-color: #f0f0f5; }
        .text-navy-black { color: #05070a; }
        .glow-purple { box-shadow: 0 0 20px rgba(138, 43, 226, 0.3); }
    </style>
</head>
<body class="h-screen flex items-center justify-center p-6">
    <div class="max-w-4xl w-full grid md:grid-cols-2 gap-8 items-center">
        <!-- Brand Side -->
        <div class="space-y-4">
            <div class="inline-block px-3 py-1 border border-pink text-pink text-[10px] font-bold tracking-[0.3em] uppercase">Live Broadcast</div>
            <h1 class="text-7xl font-black tracking-tighter uppercase italic">Radar<span class="text-pink">.</span></h1>
            <p class="text-gray-500 max-w-xs font-medium uppercase text-xs tracking-widest">Premium Dance Radio // High Fidelity Signal</p>
        </div>

        <!-- Player Side -->
        <div class="bg-[#0a0c12] border border-gray-800 p-8 glow-purple rounded-sm">
            <div class="mb-10">
                <div class="text-[10px] uppercase text-gray-500 mb-2 tracking-widest">Currently Playing</div>
                <div id="track-title" class="text-2xl font-bold truncate">...</div>
            </div>

            <div class="flex items-center gap-6">
                <button id="playBtn" class="bg-pink hover:bg-white text-white hover:text-black w-20 h-20 flex items-center justify-center transition-all">
                    <svg id="playIcon" class="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                </button>
                <div class="flex-1">
                    <input type="range" id="vol" class="w-full accent-pink h-1 bg-gray-800 appearance-none" min="0" max="1" step="0.01" value="0.7">
                    <div class="flex justify-between text-[9px] text-gray-600 mt-2 font-bold uppercase">
                        <span>Volume</span>
                        <span>Signal Stable</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <audio id="audio" crossOrigin="anonymous" src="/stream"></audio>

    <script>
        const audio = document.getElementById('audio');
        const playBtn = document.getElementById('playBtn');
        const trackTitle = document.getElementById('track-title');
        
        async function updateStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                trackTitle.innerText = data.nowPlaying;
            } catch(e) {}
        }

        setInterval(updateStatus, 3000);
        updateStatus();

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

// --- ADMIN UI (Route '/admin') ---
const adminHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>RADAR // BROADCAST STATION</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background-color: #f0f0f5; color: #05070a; font-family: 'Inter', sans-serif; }
        .bg-navy-black { background-color: #05070a; }
        .text-pink { color: #ff007f; }
        .btn-pink { background-color: #ff007f; color: white; }
    </style>
</head>
<body class="p-8">
    <div class="max-w-5xl mx-auto">
        <header class="flex justify-between items-center mb-12 border-b-4 border-black pb-4">
            <h1 class="text-4xl font-black italic uppercase tracking-tighter">Radar<span class="text-pink">.</span> Control</h1>
            <div class="text-right">
                <div class="text-[10px] font-bold uppercase">System Status</div>
                <div class="text-green-600 font-black">BROADCASTING LIVE</div>
            </div>
        </header>

        <div class="grid lg:grid-cols-3 gap-10">
            <!-- Playlist Manager -->
            <div class="lg:col-span-2">
                <h2 class="text-xl font-black mb-4 uppercase tracking-tight">Active Playlist</h2>
                <div id="playlist-container" class="bg-white border-2 border-black shadow-[8px_8px_0px_#05070a] overflow-hidden">
                    <!-- Tracks loaded via JS -->
                </div>
            </div>

            <!-- Add Track -->
            <div class="space-y-6">
                <div class="bg-black text-white p-6">
                    <h2 class="text-lg font-bold mb-4 uppercase text-pink">Add Transmission</h2>
                    <input id="new-title" type="text" placeholder="TRACK TITLE" class="w-full bg-gray-900 border-none p-3 mb-2 text-sm">
                    <input id="new-url" type="text" placeholder="STREAM/FILE URL" class="w-full bg-gray-900 border-none p-3 mb-4 text-sm">
                    <button onclick="addTrack()" class="w-full btn-pink py-3 font-bold uppercase text-xs tracking-widest hover:bg-white hover:text-black transition-colors">Add to Queue</button>
                </div>
                
                <div class="border-2 border-dashed border-gray-400 p-6">
                    <h2 class="text-xs font-bold uppercase mb-2">Manual Override</h2>
                    <button onclick="skipTrack()" class="w-full bg-black text-white py-2 text-[10px] uppercase font-bold tracking-widest mb-2">Skip to Next</button>
                    <button onclick="clearPlaylist()" class="w-full border border-red-500 text-red-500 py-2 text-[10px] uppercase font-bold tracking-widest">Clear Signal</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        async function fetchPlaylist() {
            const res = await fetch('/api/playlist');
            const data = await res.json();
            const container = document.getElementById('playlist-container');
            container.innerHTML = data.map((track, i) => \`
                <div class="p-4 border-b border-gray-100 flex justify-between items-center hover:bg-pink/5">
                    <div>
                        <span class="text-[10px] font-bold text-gray-400 mr-4">\${(i+1).toString().padStart(2, '0')}</span>
                        <span class="font-bold uppercase text-sm">\${track.title}</span>
                    </div>
                    <button onclick="playTrack(\${i})" class="text-[10px] font-black bg-black text-white px-3 py-1 hover:bg-pink transition-colors">LOAD</button>
                </div>
            \`).join('');
        }

        async function addTrack() {
            const title = document.getElementById('new-title').value;
            const url = document.getElementById('new-url').value;
            if(!title || !url) return;
            
            await fetch('/api/playlist/add', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ title, url })
            });
            fetchPlaylist();
        }

        async function playTrack(index) {
            await fetch('/api/broadcast/play/' + index, { method: 'POST' });
        }

        async function skipTrack() {
            await fetch('/api/broadcast/skip', { method: 'POST' });
        }

        fetchPlaylist();
        setInterval(fetchPlaylist, 5000);
    </script>
</body>
</html>
`;

// --- EXPRESS LOGIC ---

app.get('/', (req, res) => res.send(listenerHTML));
app.get('/admin', (req, res) => res.send(adminHTML));

// Playlist APIs
app.get('/api/playlist', (req, res) => res.json(playlist));

app.post('/api/playlist/add', (req, res) => {
    const { title, url } = req.body;
    playlist.push({ title, url });
    res.json({ success: true });
});

app.post('/api/broadcast/play/:index', (req, res) => {
    const index = parseInt(req.params.index);
    if (playlist[index]) {
        broadcastStatus.currentTrackIndex = index;
        broadcastStatus.nowPlaying = playlist[index].title;
        res.json({ success: true });
    }
});

app.post('/api/broadcast/skip', (req, res) => {
    broadcastStatus.currentTrackIndex = (broadcastStatus.currentTrackIndex + 1) % playlist.length;
    broadcastStatus.nowPlaying = playlist[broadcastStatus.currentTrackIndex].title;
    res.json({ success: true });
});

app.get('/api/status', (req, res) => {
    if (playlist.length > 0 && broadcastStatus.nowPlaying === "STATION OFFLINE") {
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
        res.status(500).send('Radio Signal Lost');
    }
});

app.listen(PORT, () => {
    console.log(`Radar Station Active on port ${PORT}`);
});