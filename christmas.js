/* RADAR Christmas Mode — visual effects + jingle management */
const ChristmasMode = {
    active: false,
    jingles: [],

    async init() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            this.active = !!settings.christmasMode;
        } catch {
            this.active = false;
        }
        if (this.active) this.applyVisuals();
        this.updateUI();
        return this.active;
    },

    async sync() {
        try {
            const res = await fetch('/api/settings');
            const settings = await res.json();
            const wasActive = this.active;
            this.active = !!settings.christmasMode;
            if (this.active && !wasActive) this.applyVisuals();
            if (!this.active && wasActive) this.removeVisuals();
            this.updateUI();
        } catch {}
    },

    applyVisuals() {
        document.body.classList.add('christmas-mode');
        this.createBackground();
        this.createGarland();
        this.createLights();
        this.createSnow();
        this.createOrnaments();
        this.loadJingles();
        this.swapDiscIcon(true);
    },

    removeVisuals() {
        document.body.classList.remove('christmas-mode');
        document.querySelector('.christmas-bg')?.remove();
        document.querySelector('.garland')?.remove();
        document.querySelector('.christmas-lights')?.remove();
        document.querySelector('.snow-container')?.remove();
        document.querySelectorAll('.ornament').forEach(el => el.remove());
        this.jingles = [];
        this.swapDiscIcon(false);
    },

    updateUI() {
        const badge = document.getElementById('xmasBadge');
        if (badge) {
            badge.classList.toggle('hidden', !this.active);
            badge.classList.toggle('flex', this.active);
        }
        const liveText = document.getElementById('liveText');
        if (liveText) {
            liveText.textContent = this.active ? 'Christmas Broadcast' : 'Live Global Sync';
        }
    },

    swapDiscIcon(toTree) {
        const disc = document.getElementById('disc');
        if (!disc) return;
        if (toTree) {
            disc.classList.remove('fa-compact-disc');
            disc.classList.add('fa-tree');
        } else {
            disc.classList.add('fa-compact-disc');
            disc.classList.remove('fa-tree');
        }
    },

    createBackground() {
        if (document.querySelector('.christmas-bg')) return;
        const bg = document.createElement('div');
        bg.className = 'christmas-bg';
        document.body.prepend(bg);
    },

    createGarland() {
        if (document.querySelector('.garland')) return;
        const garland = document.createElement('div');
        garland.className = 'garland';
        document.body.appendChild(garland);
    },

    createLights() {
        if (document.querySelector('.christmas-lights')) return;
        const container = document.createElement('div');
        container.className = 'christmas-lights';
        const colors = ['red', 'green', 'gold', 'blue', 'white'];
        const count = Math.max(8, Math.floor(window.innerWidth / 28));
        for (let i = 0; i < count; i++) {
            const light = document.createElement('div');
            light.className = 'light ' + colors[i % colors.length];
            light.style.animationDelay = (i * 0.15) + 's';
            container.appendChild(light);
        }
        document.body.appendChild(container);
    },

    createSnow() {
        if (document.querySelector('.snow-container')) return;
        const container = document.createElement('div');
        container.className = 'snow-container';
        const flakes = ['\u2744', '\u2745', '\u2746', '\u2022'];
        const count = window.innerWidth < 500 ? 35 : 50;
        for (let i = 0; i < count; i++) {
            const flake = document.createElement('div');
            flake.className = 'snowflake';
            flake.textContent = flakes[Math.floor(Math.random() * flakes.length)];
            flake.style.left = Math.random() * 100 + '%';
            flake.style.fontSize = (8 + Math.random() * 14) + 'px';
            flake.style.animationDuration = (5 + Math.random() * 10) + 's';
            flake.style.animationDelay = (Math.random() * 10) + 's';
            flake.style.opacity = 0.3 + Math.random() * 0.5;
            container.appendChild(flake);
        }
        document.body.appendChild(container);
    },

    createOrnaments() {
        if (document.querySelector('.ornament')) return;
        const colors = ['#e74c3c', '#f1c40f', '#27ae60', '#3498db', '#e84393'];
        const positions = [
            { top: '15%', left: '8%' },
            { top: '25%', left: '85%' },
            { top: '60%', left: '5%' },
            { top: '70%', left: '90%' },
            { top: '40%', left: '92%' },
        ];
        positions.forEach((pos, i) => {
            const orn = document.createElement('div');
            orn.className = 'ornament';
            orn.style.background = colors[i % colors.length];
            orn.style.top = pos.top;
            orn.style.left = pos.left;
            orn.style.animationDelay = (i * 0.5) + 's';
            orn.style.boxShadow = '0 0 10px ' + colors[i % colors.length] + '80';
            document.body.appendChild(orn);
        });
    },

    async loadJingles() {
        try {
            const res = await fetch('/api/jingles');
            this.jingles = await res.json();
        } catch {
            this.jingles = [];
        }
    },

    getRandomJingle() {
        if (this.jingles.length === 0) return null;
        return this.jingles[Math.floor(Math.random() * this.jingles.length)];
    }
};
