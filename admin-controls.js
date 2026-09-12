/* RADAR Admin Controls — calendar scheduling, jingles, settings, upload progress */

const AdminControls = {
    tracks: [],
    schedules: {},
    calendarDate: new Date(),

    // ---- Init ----
    async init() {
        await this.loadTracks();
        await this.loadSchedules();
        await this.loadJingles();
        await this.loadSettings();
        this.renderCalendar();
    },

    // ---- Tracks ----
    async loadTracks() {
        try {
            const res = await fetch('/api/tracks?all=true');
            const data = await res.json();
            this.tracks = data.tracks || [];
        } catch { this.tracks = []; }
        this.renderTrackList();
    },

    renderTrackList() {
        const container = document.getElementById('trackList');
        if (!container) return;
        if (this.tracks.length === 0) {
            container.innerHTML = '<div class="text-center py-20 text-gray-600 italic">No tracks in library</div>';
            return;
        }
        container.innerHTML = this.tracks.map(t => `
            <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-transparent hover:border-purple-500/30 transition group">
                <div class="flex items-center space-x-3 truncate">
                    <div class="w-8 h-8 bg-purple-500/10 rounded flex items-center justify-center">
                        <i class="fa-solid fa-music text-purple-500 text-xs"></i>
                    </div>
                    <span class="text-sm truncate text-gray-300 group-hover:text-white">${t.name}</span>
                </div>
                <button onclick="AdminControls.deleteTrack('${t.id}')" class="text-gray-600 hover:text-red-500 transition text-xs"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    },

    async deleteTrack(id) {
        await fetch(`/api/tracks/${id}`, { method: 'DELETE' });
        await this.loadTracks();
        await this.loadSchedules();
        this.renderCalendar();
    },

    // ---- Upload with progress ----
    uploadFiles() {
        const files = document.getElementById('fileInput').files;
        if (files.length === 0) return alert('Select files first');

        const uploadBtn = document.getElementById('uploadBtn');
        const progressBar = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        uploadBtn.disabled = true;
        uploadBtn.innerText = 'UPLOADING...';
        progressBar.classList.remove('hidden');

        const formData = new FormData();
        for (let file of files) formData.append('songs', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload');

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = pct + '%';
                progressText.innerText = pct + '%';
            }
        };

        xhr.onload = () => {
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'START UPLOAD';
            progressBar.classList.add('hidden');
            progressFill.style.width = '0%';
            if (xhr.status === 200) {
                document.getElementById('fileInput').value = '';
                document.getElementById('selectedFiles').innerText = '';
                this.loadTracks();
            } else {
                alert('Upload failed');
            }
        };

        xhr.onerror = () => {
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'START UPLOAD';
            progressBar.classList.add('hidden');
            alert('Upload failed — check connection');
        };

        xhr.send(formData);
    },

    // ---- Jingles ----
    async loadJingles() {
        try {
            const res = await fetch('/api/jingles');
            const jingles = await res.json();
            this.renderJingles(jingles);
        } catch {
            this.renderJingles([]);
        }
    },

    renderJingles(jingles) {
        const container = document.getElementById('jingleList');
        if (!container) return;
        if (jingles.length === 0) {
            container.innerHTML = '<div class="text-center py-8 text-gray-600 italic text-sm">No jingles uploaded</div>';
            return;
        }
        container.innerHTML = jingles.map(j => `
            <div class="flex items-center justify-between p-3 bg-white/5 rounded-lg group">
                <div class="flex items-center space-x-2 truncate">
                    <i class="fa-solid fa-bell text-red-400 text-xs"></i>
                    <span class="text-sm truncate text-gray-300">${j.name}</span>
                </div>
                <button onclick="AdminControls.deleteJingle('${j.id}')" class="text-gray-600 hover:text-red-500 transition text-xs"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    },

    uploadJingles() {
        const files = document.getElementById('jingleInput').files;
        if (files.length === 0) return;

        const btn = document.getElementById('jingleUploadBtn');
        btn.disabled = true;
        btn.innerText = 'UPLOADING...';

        const formData = new FormData();
        for (let file of files) formData.append('jingles', file);

        fetch('/api/jingles', { method: 'POST', body: formData })
            .then(res => res.json())
            .then(() => {
                document.getElementById('jingleInput').value = '';
                btn.disabled = false;
                btn.innerText = 'UPLOAD JINGLES';
                this.loadJingles();
            })
            .catch(() => {
                btn.disabled = false;
                btn.innerText = 'UPLOAD JINGLES';
                alert('Jingle upload failed');
            });
    },

    async deleteJingle(id) {
        await fetch(`/api/jingles/${id}`, { method: 'DELETE' });
        this.loadJingles();
    },

    // ---- Calendar / Schedule ----
    async loadSchedules() {
        try {
            const res = await fetch('/api/schedule');
            this.schedules = await res.json();
        } catch { this.schedules = {}; }
    },

    renderCalendar() {
        const container = document.getElementById('calendar');
        if (!container) return;

        const year = this.calendarDate.getFullYear();
        const month = this.calendarDate.getMonth();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date().toISOString().split('T')[0];

        let html = `
            <div class="flex justify-between items-center mb-4">
                <button onclick="AdminControls.prevMonth()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-chevron-left"></i></button>
                <span class="font-bold text-lg">${monthNames[month]} ${year}</span>
                <button onclick="AdminControls.nextMonth()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-gray-500 uppercase font-bold mb-2">
                <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
            </div>
            <div class="grid grid-cols-7 gap-1">
        `;

        for (let i = 0; i < firstDay; i++) html += '<div></div>';

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const hasSchedule = this.schedules[dateStr] && this.schedules[dateStr].length > 0;
            const isToday = dateStr === today;
            html += `
                <div onclick="AdminControls.openScheduleModal('${dateStr}')" class="aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition text-sm
                    ${isToday ? 'bg-purple-500/20 border border-purple-500/40' : 'bg-white/5 hover:bg-white/10'}
                    ${hasSchedule ? 'ring-1 ring-green-500/50' : ''}">
                    <span class="${hasSchedule ? 'text-green-400 font-bold' : 'text-gray-400'}">${d}</span>
                    ${hasSchedule ? '<span class="w-1 h-1 bg-green-500 rounded-full mt-0.5"></span>' : ''}
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    prevMonth() {
        this.calendarDate.setMonth(this.calendarDate.getMonth() - 1);
        this.renderCalendar();
    },

    nextMonth() {
        this.calendarDate.setMonth(this.calendarDate.getMonth() + 1);
        this.renderCalendar();
    },

    openScheduleModal(dateStr) {
        const modal = document.getElementById('scheduleModal');
        const title = document.getElementById('scheduleModalTitle');
        const list = document.getElementById('scheduleTrackList');
        title.innerText = `Schedule for ${dateStr}`;

        const scheduledIds = this.schedules[dateStr] || [];

        if (this.tracks.length === 0) {
            list.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No tracks uploaded yet. Upload tracks first.</p>';
        } else {
            list.innerHTML = this.tracks.map(t => `
                <label class="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" value="${t.id}" ${scheduledIds.includes(t.id) ? 'checked' : ''} class="schedule-checkbox w-4 h-4 accent-purple-500">
                    <span class="text-sm text-gray-300">${t.name}</span>
                </label>
            `).join('');
        }

        modal.dataset.date = dateStr;
        modal.classList.remove('hidden');
    },

    closeScheduleModal() {
        document.getElementById('scheduleModal').classList.add('hidden');
    },

    async saveSchedule() {
        const modal = document.getElementById('scheduleModal');
        const date = modal.dataset.date;
        const checked = [...document.querySelectorAll('.schedule-checkbox:checked')].map(cb => cb.value);

        await fetch('/api/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date, trackIds: checked })
        });

        await this.loadSchedules();
        this.closeScheduleModal();
        this.renderCalendar();
    },

    // ---- Settings ----
    async loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            this.updateSettingsUI(settings);
        } catch {}
    },

    updateSettingsUI(settings) {
        const btn = document.getElementById('adminXmasToggle');
        if (!btn) return;
        btn.classList.toggle('active', !!settings.christmasMode);
        const label = btn.querySelector('.xmas-label');
        if (label) label.textContent = settings.christmasMode ? 'Christmas ON' : 'Christmas OFF';
    },

    async toggleChristmasMode() {
        const btn = document.getElementById('adminXmasToggle');
        const isActive = btn.classList.contains('active');
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ christmasMode: !isActive })
        });
        this.updateSettingsUI({ christmasMode: !isActive });
    }
};
