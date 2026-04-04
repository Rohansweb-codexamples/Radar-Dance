const express = require('express');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Set up storage
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

// Static files
app.use(express.static(__dirname));
app.use('/uploads', express.static('uploads'));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

let serverTracks = [];

app.post('/api/upload', upload.array('songs'), (req, res) => {
    const newTracks = req.files.map(file => ({
        id: file.filename,
        name: file.originalname.replace(/\.[^/.]+$/, ""),
        url: `/uploads/${file.filename}`
    }));
    serverTracks = [...serverTracks, ...newTracks];
    res.json({ success: true, tracks: newTracks });
});

app.get('/api/tracks', (req, res) => res.json(serverTracks));

app.listen(PORT, () => console.log(`RADAR. active on ${PORT}`));