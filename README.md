# Psycho-Timer

A web app to track time spent on each patient's dossier. Runs entirely in the browser — no server or account required.

## Features

- Start/stop a timer per patient (one running at a time)
- Session history with edit and delete
- Monthly summary view
- Export sessions to CSV

## Setup

### Option 1: Open locally

Just open `index.html` in any modern browser. Data is saved in the browser's local storage.

### Option 2: Host on GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set source to the `main` branch, root folder
4. Your app will be available at `https://yourusername.github.io/repo-name/`

## Usage

- **Add a patient** — tap "+ Add Patient" and enter a nickname or ID (do not use real patient names)
- **Start/stop a timer** — tap ▶ next to a patient to start, ⏹ to stop
- **View sessions** — tap a patient's name to see their session history
- **Edit a session** — tap any session in the history to adjust times or add notes
- **Monthly summary** — tap "Summary" in the top right, navigate months with ‹ ›
- **Export** — from the Summary screen, export the current month or all sessions as CSV

## Notes

- Data is stored in the browser's local storage — it does not sync across devices
- Clearing browser data will erase all sessions; use Export regularly as a backup
- Do not use real patient names — use nicknames or dossier IDs
