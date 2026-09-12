# Radar Radio — Base44 Dev Environment

## Overview
Simple Express.js app serving a radio player UI (`index.html`) and an admin upload page (`Admin.html`). No database; uploaded tracks are stored in `./uploads/` and tracked in an in-memory array (lost on restart).

## Running
```
docker compose -f docker-compose.base44.yml up -d --build
```
App is on port 3000. Health check: `GET /`.

## Fixes applied for local dev
- `server.js`: `/admin` route now serves `Admin.html` (capital A) — Linux is case-sensitive.
- `index.html` and `Admin.html`: `API_BASE` changed from hardcoded `https://radar-dance-radio.onrender.com` to `''` (relative) so the frontend talks to the local server.

## No external secrets required
All dependencies (express, multer, cors) are npm packages. No external services.
