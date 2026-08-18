# 🏋️ Office Gym Booking System

A lightweight, clean, and mobile-friendly self-hosted web application for managing an internal office gym (~20 people). Built with **zero external dependencies** (Python standard library + SQLite3 + Vanilla JS/CSS).

![Clean and Simple UI](public/index.html)

---

## ✨ Features

- 📅 **Interactive Visual Calendar**: 7-day grid on desktop and swipeable day tabs on mobile phones.
- ⚡ **1-Click Booking & Cancellation**: Instant reservation with live capacity indicators (e.g. *3 spots left*, *Full*).
- 👤 **Member Management**: Add/remove members with instant roster update.
- 📱 **Mobile First & Responsive**: Optimized touch targets and layout for smartphones and desktops.
- 🌙 **Dark & Light Modes**: Seamless theme switching with automatic system preference detection.
- 🔒 **Data Integrity**: Enforces max capacity per slot and prevents double-booking at the database level.
- 🚀 **Zero Dependencies**: Runs with standard Python 3. No `npm`, `pip`, or complex build steps required!

---

## 🚀 Quick Start (Local Run)

### 1. Run with Python
```bash
python3 server.py
```
Or use the helper script:
```bash
./run.sh
```

### 2. Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)** on your computer or phone on the same Wi-Fi.

---

## 🌐 Self-Hosting & Deployment

### Option A: Standard Linux VPS / Server (Direct)
1. Clone or copy this directory to your server.
2. Run in the background using `systemd`, `nohup`, or `pm2`:
   ```bash
   # Using nohup:
   nohup python3 server.py > gym.log 2>&1 &

   # Or using PM2:
   pm2 start server.py --name gym-booking --interpreter python3
   ```
3. (Recommended) Set up Nginx or Caddy reverse proxy to provide HTTPS/SSL.

### Option B: Docker / Docker Compose
1. Launch the container:
   ```bash
   docker-compose up -d
   ```
2. The database `gym.db` will persist in the Docker volume automatically across restarts and updates.

---

## ⚙️ Configuration (Environment Variables)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP port the server listens on |
| `GYM_CAPACITY` | `4` | Max number of people allowed per 1-hour slot |
| `START_HOUR` | `6` | Gym opening hour (06:00) |
| `END_HOUR` | `21` | Gym closing hour (21:00) |
| `GYM_NAME` | `Office Gym` | Title shown in the header |
| `DB_PATH` | `gym.db` | Path to SQLite database file |

Example custom startup:
```bash
PORT=8080 GYM_CAPACITY=5 START_HOUR=7 END_HOUR=22 python3 server.py
```

---

## 📁 Project Structure

```
.
├── server.py              # Zero-dependency Python server (API + SQLite + Static files)
├── gym.db                 # Auto-generated SQLite database
├── public/                # Web frontend assets
│   ├── index.html         # HTML5 UI structure
│   ├── style.css          # Modern CSS (dark/light mode, mobile-first design)
│   └── app.js             # Vanilla JS reactive client logic
├── Dockerfile             # Alpine-based lightweight container
├── docker-compose.yml     # Containerized deployment config
├── run.sh                 # Quick launch script
├── IMPLEMENTATION_PLAN.md # Detailed specification document
└── README.md              # Documentation
```
