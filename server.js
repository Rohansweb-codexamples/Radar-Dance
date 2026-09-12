const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Data persistence (survives restarts) ---
const DATA_FILE = path.join(__dirname, 'data.json');

function loadData() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch {
        return { tracks: [], schedules: {}, jingles: [], settings: { christmasMode: false } };
    }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = loadData();

// --- File upload storage ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// --- Static files ---
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// --- Page routes ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'Admin.html')));

// --- Tracks API ---
app.post('/api/upload', upload.array('songs'), (req, res) => {
    const newTracks = req.files.map(file => ({
        id: file.filename,
        name: file.originalname.replace(/\.[^/.]+$/, ""),
        url: `/uploads/${file.filename}`
    }));
    data.tracks = [...data.tracks, ...newTracks];
    saveData();
    res.json({ success: true, tracks: newTracks });
});

app.get('/api/tracks', (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const scheduledIds = data.schedules[today];
    if (scheduledIds && scheduledIds.length > 0) {
        const scheduledTracks = data.tracks.filter(t => scheduledIds.includes(t.id));
        if (scheduledTracks.length > 0) {
            return res.json({ tracks: scheduledTracks, scheduled: true, date: today });
        }
    }
    res.json({ tracks: data.tracks, scheduled: false });
});

app.delete('/api/tracks/:id', (req, res) => {
    data.tracks = data.tracks.filter(t => t.id !== req.params.id);
    for (const date in data.schedules) {
        data.schedules[date] = data.schedules[date].filter(id => id !== req.params.id);
    }
    saveData();
    res.json({ success: true });
});

// --- Jingles API (Christmas mode only) ---
app.post('/api/jingles', upload.array('jingles'), (req, res) => {
    const newJingles = req.files.map(file => ({
        id: file.filename,
        name: file.originalname.replace(/\.[^/.]+$/, ""),
        url: `/uploads/${file.filename}`
    }));
    data.jingles = [...data.jingles, ...newJingles];
    saveData();
    res.json({ success: true, jingles: newJingles });
});

app.get('/api/jingles', (req, res) => res.json(data.jingles));

app.delete('/api/jingles/:id', (req, res) => {
    data.jingles = data.jingles.filter(j => j.id !== req.params.id);
    saveData();
    res.json({ success: true });
});

// --- Schedule API (calendar auto-broadcast) ---
app.get('/api/schedule', (req, res) => res.json(data.schedules));

app.post('/api/schedule', (req, res) => {
    const { date, trackIds } = req.body;
    if (!date) return res.status(400).json({ error: 'Date required' });
    if (trackIds && trackIds.length > 0) {
        data.schedules[date] = trackIds;
    } else {
        delete data.schedules[date];
    }
    saveData();
    res.json({ success: true, schedules: data.schedules });
});

// --- Settings API (Christmas mode toggle) ---
app.get('/api/settings', (req, res) => res.json(data.settings));

app.post('/api/settings', (req, res) => {
    data.settings = { ...data.settings, ...req.body };
    saveData();
    res.json({ success: true, settings: data.settings });
});

app.listen(PORT, () => console.log(`RADAR. active on ${PORT}`));
