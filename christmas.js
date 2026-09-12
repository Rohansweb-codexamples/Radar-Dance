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
        this.updateToggleButton();
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
            this.updateToggleButton();
        } catch {}
    },

    async toggle() {
        this.active = !this.active;
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ christmasMode: this.active })
        });
        if (this.active) {
            this.applyVisuals();
        } else {
            this.removeVisuals();
        }
        this.updateToggleButton();
    },

    applyVisuals() {
        document.body.classList.add('christmas-mode');
        this.createBackground();
        this.createLights();
        this.createSnow();
        this.loadJingles();
    },

    removeVisuals() {
        document.body.classList.remove('christmas-mode');
        document.querySelector('.christmas-bg')?.remove();
        document.querySelector('.christmas-lights')?.remove();
        document.querySelector('.snow-container')?.remove();
        this.jingles = [];
    },

    updateToggleButton() {
        const btn = document.getElementById('xmasToggle');
        if (!btn) return;
        btn.classList.toggle('active', this.active);
        const label = btn.querySelector('.xmas-label');
        if (label) label.textContent = this.active ? 'Christmas ON' : 'Christmas OFF';
    },

    createBackground() {
        if (document.querySelector('.christmas-bg')) return;
        const bg = document.createElement('div');
        bg.className = 'christmas-bg';
        document.body.prepend(bg);
    },

    createLights() {
        if (document.querySelector('.christmas-lights')) return;
        const container = document.createElement('div');
        container.className = 'christmas-lights';
        const colors = ['red', 'green', 'gold', 'blue', 'white'];
        const count = Math.floor(window.innerWidth / 28);
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
        for (let i = 0; i < 40; i++) {
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
