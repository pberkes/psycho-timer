# Psycho-Timer

A web app to track time spent on each patient's dossier. Runs entirely in the browser — no server or account required.

## Features

- Start/stop a timer per patient (one running at a time)
- Session history with edit and delete
- Monthly summary view
- Three CSV export options: month sessions, month totals per patient, all sessions

## Setup

### Option 1: Open locally

Open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge). Data is saved in the browser's local storage on that device.

### Option 2: Host on GitHub Pages

The app is published from the `published` branch. To deploy an update:

1. Merge your changes into `main` and push
2. Reset the `published` branch to `main` and push:
   ```
   git checkout published && git reset --hard main && git push origin published && git checkout main
   ```

The app is available at `https://pberkes.github.io/psycho-timer/`

## Important notes

- Data is stored in the browser's local storage — it does **not** sync across devices
- Clearing browser data will erase all sessions — export regularly as a backup
- Do not use real patient names — use nicknames or dossier IDs only

---

## User Guide

### Adding a patient

1. On the main screen, tap **+ Add Patient**
2. Enter a nickname or dossier ID (not a real name)
3. Tap **Save**

The patient appears in the list immediately.

### Timing a session

1. Tap **▶** next to a patient to start the timer
2. The timer runs live and the card turns green
3. Tap **⏹** to stop — the session is saved automatically

Only one timer can run at a time. Starting a new one stops the current one.

> **Note:** The timer does not survive closing the browser tab or reloading the page. Always stop it before leaving.

### Editing or deleting a patient

Tap **✏️** next to any patient to open the edit modal.

- To rename: change the name and tap **Save**
- To delete: tap **Delete** → confirm with **Yes, delete** — this removes the patient and all their sessions permanently

### Viewing session history

Tap a patient's **name** to open their session history, sorted most recent first.

### Editing or deleting a session

1. In the session history, tap any session
2. Adjust the start/end time or add notes, then tap **Save**
3. Or tap **Delete** (red button) to remove it — you will be asked to confirm

### Monthly summary

Tap **Summary** (top right) to see total time per patient for the current month.
Use **‹** and **›** to navigate between months.

### Exporting data

From the Summary screen, three export options are available:

| Button | Contents |
|---|---|
| **Export month as CSV** | All individual sessions for the selected month |
| **Export month totals per patient as CSV** | One row per patient with their total time for the selected month |
| **Export all sessions as CSV** | Every session ever recorded, all patients |

CSV files open in Excel, Numbers, or any spreadsheet app.

### Backing up your data

Local storage can be wiped if you clear your browser's cache or switch browsers.
Export your data regularly using **Export all sessions as CSV** and keep the file somewhere safe.
