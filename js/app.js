import { initializeApp }                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
                                                   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot,
         query, orderBy, serverTimestamp, Timestamp }
                                                   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { firebaseConfig }                          from "./firebase-config.js";

// ── Firebase init ──────────────────────────────────────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ──────────────────────────────────────────────────────────────────
let currentUser     = null;
let patients        = [];          // [{id, name, createdAt}]
let runningPatientId = null;       // id of patient whose timer is running
let runningStart    = null;        // Date when current session started
let tickInterval    = null;
let currentPatientId = null;       // for history screen
let summaryYear     = new Date().getFullYear();
let summaryMonth    = new Date().getMonth();   // 0-based
let editingSessionId = null;
let editingPatientId = null;
let unsubPatients   = null;

// ── Helpers ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}

function formatDuration(seconds) {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2,"0")}m`;
  return `${m}m ${s.toString().padStart(2,"0")}s`;
}

function formatDate(ts) {
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { day:"2-digit", month:"short", year:"numeric",
                                            hour:"2-digit", minute:"2-digit" });
}

function toDatetimeLocal(date) {
  const d = date instanceof Timestamp ? date.toDate() : new Date(date);
  const pad = n => n.toString().padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function patientRef(pid)           { return doc(db,  "users", currentUser.uid, "patients", pid); }
function patientsCol()             { return collection(db, "users", currentUser.uid, "patients"); }
function sessionsCol(pid)          { return collection(db, "users", currentUser.uid, "patients", pid, "sessions"); }
function sessionRef(pid, sid)      { return doc(db,   "users", currentUser.uid, "patients", pid, "sessions", sid); }

// ── Auth ───────────────────────────────────────────────────────────────────
$("btn-google-login").addEventListener("click", () => {
  signInWithPopup(auth, new GoogleAuthProvider()).catch(console.error);
});

$("btn-logout").addEventListener("click", () => {
  stopRunningTimer(false);
  signOut(auth);
});

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) {
    subscribePatients();
    showScreen("screen-main");
  } else {
    if (unsubPatients) { unsubPatients(); unsubPatients = null; }
    patients = [];
    showScreen("screen-auth");
  }
});

// ── Patient subscription ───────────────────────────────────────────────────
function subscribePatients() {
  const q = query(patientsCol(), orderBy("name"));
  unsubPatients = onSnapshot(q, snap => {
    patients = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPatientList();
  });
}

// ── Render patient list ────────────────────────────────────────────────────
function renderPatientList() {
  const list = $("patient-list");
  if (patients.length === 0) {
    list.innerHTML = `<p class="empty">No patients yet. Add one below.</p>`;
    return;
  }
  list.innerHTML = patients.map(p => {
    const isRunning = p.id === runningPatientId;
    const elapsed   = isRunning ? Math.floor((Date.now() - runningStart) / 1000) : 0;
    return `
      <div class="patient-card${isRunning ? " running" : ""}" data-id="${p.id}">
        <div class="patient-info" data-action="history" data-id="${p.id}">
          <div class="patient-name">${escHtml(p.name)}</div>
          <div class="patient-total" id="total-${p.id}">loading…</div>
        </div>
        <div class="timer-display" id="timer-${p.id}">${isRunning ? formatDuration(elapsed) : ""}</div>
        <button class="btn-timer${isRunning ? " stop" : ""}" data-action="toggle" data-id="${p.id}">
          ${isRunning ? "⏹" : "▶"}
        </button>
        <button class="btn-edit-patient" data-action="edit" data-id="${p.id}" data-name="${escAttr(p.name)}">✏️</button>
      </div>`;
  }).join("");

  // Load totals async
  patients.forEach(p => loadPatientTotal(p.id));
}

async function loadPatientTotal(pid) {
  const q = query(sessionsCol(pid), orderBy("startTime"));
  // one-time read via onSnapshot unsubscribe immediately
  const unsub = onSnapshot(q, snap => {
    const total = snap.docs.reduce((sum, d) => {
      const data = d.data();
      return sum + (data.duration || 0);
    }, 0);
    const el = $(`total-${pid}`);
    if (el) el.textContent = total > 0 ? `Total: ${formatDuration(total)}` : "No sessions yet";
    unsub();
  });
}

$("patient-list").addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id, name } = btn.dataset;
  if (action === "toggle") toggleTimer(id);
  if (action === "history") openHistory(id);
  if (action === "edit")    openPatientModal(id, name);
});

// ── Timer ──────────────────────────────────────────────────────────────────
function toggleTimer(pid) {
  if (runningPatientId === pid) {
    stopRunningTimer(true);
  } else {
    if (runningPatientId) stopRunningTimer(true);
    startTimer(pid);
  }
}

function startTimer(pid) {
  runningPatientId = pid;
  runningStart     = Date.now();
  renderPatientList();
  tickInterval = setInterval(() => {
    const el = $(`timer-${pid}`);
    if (el) el.textContent = formatDuration(Math.floor((Date.now() - runningStart) / 1000));
  }, 1000);
}

async function stopRunningTimer(save) {
  if (!runningPatientId) return;
  clearInterval(tickInterval);
  tickInterval = null;
  const pid   = runningPatientId;
  const start = runningStart;
  runningPatientId = null;
  runningStart     = null;
  renderPatientList();
  if (save && currentUser) {
    const end      = Date.now();
    const duration = Math.floor((end - start) / 1000);
    if (duration < 1) return;
    await addDoc(sessionsCol(pid), {
      startTime: Timestamp.fromMillis(start),
      endTime:   Timestamp.fromMillis(end),
      duration,
      notes: "",
      createdAt: serverTimestamp(),
    });
    loadPatientTotal(pid);
  }
}

// ── Patient modal ──────────────────────────────────────────────────────────
$("btn-add-patient").addEventListener("click",    () => openPatientModal(null, ""));
$("btn-cancel-patient").addEventListener("click", closePatientModal);
$("btn-save-patient").addEventListener("click",   savePatient);
$("input-patient-name").addEventListener("keydown", e => { if (e.key === "Enter") savePatient(); });

function openPatientModal(pid, name) {
  $("modal-patient-title").textContent = pid ? "Edit Patient" : "Add Patient";
  $("input-patient-name").value        = name || "";
  $("modal-patient").dataset.pid       = pid || "";
  $("modal-patient").classList.remove("hidden");
  $("input-patient-name").focus();
}

function closePatientModal() {
  $("modal-patient").classList.add("hidden");
}

async function savePatient() {
  const name = $("input-patient-name").value.trim();
  if (!name) return;
  const pid  = $("modal-patient").dataset.pid;
  if (pid) {
    await setDoc(patientRef(pid), { name }, { merge: true });
  } else {
    await addDoc(patientsCol(), { name, createdAt: serverTimestamp() });
  }
  closePatientModal();
}

// ── History screen ─────────────────────────────────────────────────────────
function openHistory(pid) {
  currentPatientId = pid;
  const p = patients.find(x => x.id === pid);
  $("history-patient-name").textContent = p ? p.name : "";
  showScreen("screen-history");
  loadSessions(pid);
}

$("btn-back-main").addEventListener("click", () => showScreen("screen-main"));

let unsubSessions = null;

function loadSessions(pid) {
  if (unsubSessions) unsubSessions();
  const q = query(sessionsCol(pid), orderBy("startTime", "desc"));
  unsubSessions = onSnapshot(q, snap => {
    const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSessions(sessions, pid);
  });
}

function renderSessions(sessions, pid) {
  const list = $("session-list");
  if (sessions.length === 0) {
    list.innerHTML = `<p class="empty">No sessions recorded yet.</p>`;
    return;
  }
  list.innerHTML = sessions.map(s => `
    <div class="session-item" data-action="edit-session" data-pid="${pid}" data-sid="${s.id}">
      <div class="session-info">
        <div class="session-date">${formatDate(s.startTime)}</div>
        <div class="session-duration">${formatDuration(s.duration || 0)}</div>
        ${s.notes ? `<div class="session-notes">${escHtml(s.notes)}</div>` : ""}
      </div>
      <span style="color:var(--text-muted)">›</span>
    </div>`).join("");
}

$("session-list").addEventListener("click", e => {
  const el = e.target.closest("[data-action='edit-session']");
  if (!el) return;
  openSessionModal(el.dataset.pid, el.dataset.sid);
});

// ── Session modal ──────────────────────────────────────────────────────────
$("btn-cancel-session").addEventListener("click", closeSessionModal);
$("btn-save-session").addEventListener("click",   saveSession);
$("btn-delete-session").addEventListener("click", deleteSession);

async function openSessionModal(pid, sid) {
  editingPatientId = pid;
  editingSessionId = sid;
  // fetch session data from already-loaded list
  const list = $("session-list");
  const item = list.querySelector(`[data-sid="${sid}"]`);
  // re-fetch from Firestore to get full data
  const unsub = onSnapshot(sessionRef(pid, sid), snap => {
    const data = snap.data();
    if (!data) return;
    $("input-session-start").value = toDatetimeLocal(data.startTime);
    $("input-session-end").value   = toDatetimeLocal(data.endTime);
    $("input-session-notes").value = data.notes || "";
    unsub();
  });
  $("modal-session").classList.remove("hidden");
}

function closeSessionModal() {
  $("modal-session").classList.add("hidden");
  editingSessionId = null;
  editingPatientId = null;
}

async function saveSession() {
  const start    = new Date($("input-session-start").value);
  const end      = new Date($("input-session-end").value);
  const notes    = $("input-session-notes").value.trim();
  if (isNaN(start) || isNaN(end) || end <= start) {
    alert("Please enter a valid start and end time.");
    return;
  }
  const duration = Math.floor((end - start) / 1000);
  await setDoc(sessionRef(editingPatientId, editingSessionId), {
    startTime: Timestamp.fromDate(start),
    endTime:   Timestamp.fromDate(end),
    duration,
    notes,
  }, { merge: true });
  closeSessionModal();
}

async function deleteSession() {
  if (!confirm("Delete this session?")) return;
  await deleteDoc(sessionRef(editingPatientId, editingSessionId));
  closeSessionModal();
}

// ── Summary screen ─────────────────────────────────────────────────────────
$("btn-summary").addEventListener("click", openSummary);
$("btn-back-summary").addEventListener("click", () => showScreen("screen-main"));
$("btn-prev-month").addEventListener("click", () => { summaryMonth--; if (summaryMonth < 0) { summaryMonth = 11; summaryYear--; } renderSummary(); });
$("btn-next-month").addEventListener("click", () => { summaryMonth++; if (summaryMonth > 11) { summaryMonth = 0; summaryYear++; } renderSummary(); });
$("btn-export-summary").addEventListener("click", exportMonthCSV);
$("btn-export-all").addEventListener("click",     exportAllCSV);

function openSummary() {
  summaryYear  = new Date().getFullYear();
  summaryMonth = new Date().getMonth();
  showScreen("screen-summary");
  renderSummary();
}

async function renderSummary() {
  const label = new Date(summaryYear, summaryMonth, 1)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" });
  $("summary-month-label").textContent = label;

  const monthStart = new Date(summaryYear, summaryMonth, 1).getTime();
  const monthEnd   = new Date(summaryYear, summaryMonth + 1, 1).getTime();

  const rows = await Promise.all(patients.map(async p => {
    const q    = query(sessionsCol(p.id), orderBy("startTime"));
    return new Promise(resolve => {
      const unsub = onSnapshot(q, snap => {
        const total = snap.docs.reduce((sum, d) => {
          const data = d.data();
          const t    = data.startTime instanceof Timestamp
                       ? data.startTime.toMillis()
                       : new Date(data.startTime).getTime();
          if (t >= monthStart && t < monthEnd) return sum + (data.duration || 0);
          return sum;
        }, 0);
        unsub();
        resolve({ name: p.name, total });
      });
    });
  }));

  const sorted = rows.filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  const list   = $("summary-list");
  if (sorted.length === 0) {
    list.innerHTML = `<p class="empty">No sessions this month.</p>`;
    return;
  }
  list.innerHTML = sorted.map(r => `
    <div class="summary-row">
      <span class="summary-name">${escHtml(r.name)}</span>
      <span class="summary-time">${formatDuration(r.total)}</span>
    </div>`).join("");
}

// ── CSV export ─────────────────────────────────────────────────────────────
async function exportMonthCSV() {
  const monthStart = new Date(summaryYear, summaryMonth, 1).getTime();
  const monthEnd   = new Date(summaryYear, summaryMonth + 1, 1).getTime();
  const rows       = [["Patient", "Date", "Start", "End", "Duration (s)", "Notes"]];

  for (const p of patients) {
    const q = query(sessionsCol(p.id), orderBy("startTime"));
    await new Promise(resolve => {
      const unsub = onSnapshot(q, snap => {
        snap.docs.forEach(d => {
          const data  = d.data();
          const start = data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime);
          const end   = data.endTime   instanceof Timestamp ? data.endTime.toDate()   : new Date(data.endTime);
          if (start.getTime() >= monthStart && start.getTime() < monthEnd) {
            rows.push([p.name, start.toLocaleDateString(), start.toLocaleTimeString(),
                       end.toLocaleTimeString(), data.duration || 0, data.notes || ""]);
          }
        });
        unsub();
        resolve();
      });
    });
  }

  const label = new Date(summaryYear, summaryMonth, 1)
    .toLocaleDateString(undefined, { month: "long", year: "numeric" }).replace(" ", "-");
  downloadCSV(rows, `psycho-timer-${label}.csv`);
}

async function exportAllCSV() {
  const rows = [["Patient", "Date", "Start", "End", "Duration (s)", "Notes"]];
  for (const p of patients) {
    const q = query(sessionsCol(p.id), orderBy("startTime"));
    await new Promise(resolve => {
      const unsub = onSnapshot(q, snap => {
        snap.docs.forEach(d => {
          const data  = d.data();
          const start = data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(data.startTime);
          const end   = data.endTime   instanceof Timestamp ? data.endTime.toDate()   : new Date(data.endTime);
          rows.push([p.name, start.toLocaleDateString(), start.toLocaleTimeString(),
                     end.toLocaleTimeString(), data.duration || 0, data.notes || ""]);
        });
        unsub();
        resolve();
      });
    });
  }
  downloadCSV(rows, "psycho-timer-all.csv");
}

function downloadCSV(rows, filename) {
  const csv  = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── Security helpers ───────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function escAttr(str) { return escHtml(str); }
