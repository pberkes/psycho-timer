// ── Storage ────────────────────────────────────────────────────────────────
function loadPatients() {
  return JSON.parse(localStorage.getItem("pt_patients") || "[]");
}
function savePatients(list) {
  localStorage.setItem("pt_patients", JSON.stringify(list));
}
function loadSessions(pid) {
  return JSON.parse(localStorage.getItem(`pt_sessions_${pid}`) || "[]");
}
function saveSessions(pid, list) {
  localStorage.setItem(`pt_sessions_${pid}`, JSON.stringify(list));
}
function saveRunningState(pid, startTime) {
  localStorage.setItem("pt_running", JSON.stringify({ pid, startTime }));
}
function clearRunningState() {
  localStorage.removeItem("pt_running");
}
function loadRunningState() {
  return JSON.parse(localStorage.getItem("pt_running") || "null");
}
function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── State ──────────────────────────────────────────────────────────────────
let patients         = loadPatients();
let runningPatientId = null;
let runningStart     = null;
let tickInterval     = null;
let currentPatientId = null;
let summaryYear      = new Date().getFullYear();
let summaryMonth     = new Date().getMonth();
let editingSessionId = null;
let editingPatientId = null;

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

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day:"2-digit", month:"short", year:"numeric",
                                           hour:"2-digit", minute:"2-digit" });
}

function toDatetimeLocal(iso) {
  const d = new Date(iso);
  const pad = n => n.toString().padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
                    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function patientTotal(pid) {
  return loadSessions(pid).reduce((sum, s) => sum + (s.duration || 0), 0);
}

// ── Boot ───────────────────────────────────────────────────────────────────
showScreen("screen-main");
const _savedRunning = loadRunningState();
if (_savedRunning) {
  runningPatientId = _savedRunning.pid;
  runningStart     = _savedRunning.startTime;
  tickInterval = setInterval(() => {
    const el = $(`timer-${runningPatientId}`);
    if (el) el.textContent = formatDuration(Math.floor((Date.now() - runningStart) / 1000));
  }, 1000);
}
renderPatientList();

// ── Render patient list ────────────────────────────────────────────────────
function renderPatientList() {
  patients = loadPatients();
  const list = $("patient-list");
  if (patients.length === 0) {
    list.innerHTML = `<p class="empty">No patients yet. Add one below.</p>`;
    return;
  }
  list.innerHTML = patients.map(p => {
    const isRunning = p.id === runningPatientId;
    const elapsed   = isRunning ? Math.floor((Date.now() - runningStart) / 1000) : 0;
    const total     = patientTotal(p.id);
    return `
      <div class="patient-card${isRunning ? " running" : ""}" data-id="${p.id}">
        <div class="patient-info" data-action="history" data-id="${p.id}">
          <div class="patient-name">${escHtml(p.name)}</div>
          <div class="patient-total">${total > 0 ? `Total: ${formatDuration(total)}` : "No sessions yet"}</div>
        </div>
        <div class="timer-display" id="timer-${p.id}">${isRunning ? formatDuration(elapsed) : ""}</div>
        <button class="btn-timer${isRunning ? " stop" : ""}" data-action="toggle" data-id="${p.id}">
          ${isRunning ? "⏹" : "▶"}
        </button>
        <button class="btn-edit-patient" data-action="edit" data-id="${p.id}" data-name="${escHtml(p.name)}">✏️</button>
      </div>`;
  }).join("");
}

$("patient-list").addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id, name } = btn.dataset;
  if (action === "toggle")  toggleTimer(id);
  if (action === "history") openHistory(id);
  if (action === "edit")    openPatientModal(id, name);
});

// ── Timer ──────────────────────────────────────────────────────────────────
function toggleTimer(pid) {
  if (runningPatientId === pid) {
    stopRunningTimer();
  } else {
    if (runningPatientId) stopRunningTimer();
    startTimer(pid);
  }
}

function startTimer(pid) {
  runningPatientId = pid;
  runningStart     = Date.now();
  saveRunningState(pid, runningStart);
  renderPatientList();
  tickInterval = setInterval(() => {
    const el = $(`timer-${pid}`);
    if (el) el.textContent = formatDuration(Math.floor((Date.now() - runningStart) / 1000));
  }, 1000);
}

function stopRunningTimer() {
  if (!runningPatientId) return;
  clearInterval(tickInterval);
  tickInterval = null;
  const pid      = runningPatientId;
  const start    = runningStart;
  runningPatientId = null;
  runningStart     = null;
  clearRunningState();
  const end      = Date.now();
  const duration = Math.floor((end - start) / 1000);
  if (duration >= 1) {
    const sessions = loadSessions(pid);
    sessions.push({ id: newId(), startTime: new Date(start).toISOString(),
                    endTime: new Date(end).toISOString(), duration, notes: "" });
    saveSessions(pid, sessions);
  }
  renderPatientList();
}

// ── Patient modal ──────────────────────────────────────────────────────────
$("btn-add-patient").addEventListener("click",         () => openPatientModal(null, ""));
$("btn-cancel-patient").addEventListener("click",      closePatientModal);
$("btn-save-patient").addEventListener("click",        savePatient);
$("btn-delete-patient").addEventListener("click",      showDeleteConfirm);
$("btn-cancel-delete-patient").addEventListener("click", hideDeleteConfirm);
$("btn-confirm-delete-patient").addEventListener("click", deletePatient);
$("input-patient-name").addEventListener("keydown", e => { if (e.key === "Enter") savePatient(); });

function openPatientModal(pid, name) {
  $("modal-patient-title").textContent = pid ? "Edit Patient" : "Add Patient";
  $("input-patient-name").value        = name || "";
  $("modal-patient").dataset.pid       = pid || "";
  $("btn-delete-patient").style.display = pid ? "" : "none";
  $("modal-patient").classList.remove("hidden");
  setTimeout(() => $("input-patient-name").focus(), 50);
}

function closePatientModal() {
  $("modal-patient").classList.add("hidden");
  hideDeleteConfirm();
}

function showDeleteConfirm() {
  $("patient-modal-actions").style.display = "none";
  $("patient-modal-confirm").style.display = "";
}

function hideDeleteConfirm() {
  $("patient-modal-actions").style.display = "";
  $("patient-modal-confirm").style.display = "none";
}

function savePatient() {
  const name = $("input-patient-name").value.trim();
  if (!name) return;
  const pid  = $("modal-patient").dataset.pid;
  patients   = loadPatients();
  if (pid) {
    const p = patients.find(x => x.id === pid);
    if (p) p.name = name;
  } else {
    patients.push({ id: newId(), name, createdAt: new Date().toISOString() });
  }
  savePatients(patients);
  closePatientModal();
  renderPatientList();
}

function deletePatient() {
  const pid = $("modal-patient").dataset.pid;
  if (!pid) return;
  if (runningPatientId === pid) { clearInterval(tickInterval); runningPatientId = null; runningStart = null; clearRunningState(); }
  patients = loadPatients().filter(x => x.id !== pid);
  savePatients(patients);
  localStorage.removeItem(`pt_sessions_${pid}`);
  closePatientModal();
  renderPatientList();
}

// ── History screen ─────────────────────────────────────────────────────────
function openHistory(pid) {
  currentPatientId = pid;
  const p = patients.find(x => x.id === pid);
  $("history-patient-name").textContent = p ? p.name : "";
  showScreen("screen-history");
  renderSessions(pid);
}

$("btn-back-main").addEventListener("click", () => {
  showScreen("screen-main");
  renderPatientList();
});

function renderSessions(pid) {
  const sessions = loadSessions(pid).slice().sort((a,b) => new Date(b.startTime) - new Date(a.startTime));
  const list     = $("session-list");
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

function openSessionModal(pid, sid) {
  editingPatientId = pid;
  editingSessionId = sid;
  const session = loadSessions(pid).find(s => s.id === sid);
  if (!session) return;
  $("input-session-start").value = toDatetimeLocal(session.startTime);
  $("input-session-end").value   = toDatetimeLocal(session.endTime);
  $("input-session-notes").value = session.notes || "";
  $("modal-session").classList.remove("hidden");
}

function closeSessionModal() {
  $("modal-session").classList.add("hidden");
  editingSessionId = null;
  editingPatientId = null;
}

function saveSession() {
  const start = new Date($("input-session-start").value);
  const end   = new Date($("input-session-end").value);
  const notes = $("input-session-notes").value.trim();
  if (isNaN(start) || isNaN(end) || end <= start) {
    alert("Please enter a valid start and end time.");
    return;
  }
  const sessions = loadSessions(editingPatientId);
  const s        = sessions.find(x => x.id === editingSessionId);
  if (s) {
    s.startTime = start.toISOString();
    s.endTime   = end.toISOString();
    s.duration  = Math.floor((end - start) / 1000);
    s.notes     = notes;
  }
  saveSessions(editingPatientId, sessions);
  closeSessionModal();
  renderSessions(editingPatientId);
  renderPatientList();
}

function deleteSession() {
  if (!confirm("Delete this session?")) return;
  const sessions = loadSessions(editingPatientId).filter(s => s.id !== editingSessionId);
  saveSessions(editingPatientId, sessions);
  closeSessionModal();
  renderSessions(editingPatientId);
  renderPatientList();
}

// ── Summary screen ─────────────────────────────────────────────────────────
$("btn-summary").addEventListener("click", openSummary);
$("btn-back-summary").addEventListener("click", () => showScreen("screen-main"));
$("btn-prev-month").addEventListener("click", () => {
  summaryMonth--;
  if (summaryMonth < 0) { summaryMonth = 11; summaryYear--; }
  renderSummary();
});
$("btn-next-month").addEventListener("click", () => {
  summaryMonth++;
  if (summaryMonth > 11) { summaryMonth = 0; summaryYear++; }
  renderSummary();
});
$("btn-export-summary").addEventListener("click", exportMonthCSV);
$("btn-export-totals").addEventListener("click",  exportTotalsCSV);
$("btn-export-all").addEventListener("click",     exportAllCSV);

function openSummary() {
  summaryYear  = new Date().getFullYear();
  summaryMonth = new Date().getMonth();
  showScreen("screen-summary");
  renderSummary();
}

function renderSummary() {
  const label = new Date(summaryYear, summaryMonth, 1)
    .toLocaleDateString(undefined, { month:"long", year:"numeric" });
  $("summary-month-label").textContent = label;

  const monthStart = new Date(summaryYear, summaryMonth, 1).getTime();
  const monthEnd   = new Date(summaryYear, summaryMonth + 1, 1).getTime();

  patients = loadPatients();
  const rows = patients.map(p => {
    const total = loadSessions(p.id).reduce((sum, s) => {
      const t = new Date(s.startTime).getTime();
      return (t >= monthStart && t < monthEnd) ? sum + (s.duration || 0) : sum;
    }, 0);
    return { name: p.name, total };
  }).filter(r => r.total > 0).sort((a,b) => b.total - a.total);

  const list = $("summary-list");
  if (rows.length === 0) {
    list.innerHTML = `<p class="empty">No sessions this month.</p>`;
    return;
  }
  list.innerHTML = rows.map(r => `
    <div class="summary-row">
      <span class="summary-name">${escHtml(r.name)}</span>
      <span class="summary-time">${formatDuration(r.total)}</span>
    </div>`).join("");
}

// ── CSV export ─────────────────────────────────────────────────────────────
function exportMonthCSV() {
  const monthStart = new Date(summaryYear, summaryMonth, 1).getTime();
  const monthEnd   = new Date(summaryYear, summaryMonth + 1, 1).getTime();
  const rows       = [["Patient","Date","Start","End","Duration (s)","Notes"]];
  patients = loadPatients();
  for (const p of patients) {
    for (const s of loadSessions(p.id)) {
      const t = new Date(s.startTime).getTime();
      if (t >= monthStart && t < monthEnd) {
        const start = new Date(s.startTime);
        const end   = new Date(s.endTime);
        rows.push([p.name, start.toLocaleDateString(), start.toLocaleTimeString(),
                   end.toLocaleTimeString(), s.duration || 0, s.notes || ""]);
      }
    }
  }
  const label = new Date(summaryYear, summaryMonth, 1)
    .toLocaleDateString(undefined, { month:"long", year:"numeric" }).replace(" ", "-");
  downloadCSV(rows, `psycho-timer-${label}.csv`);
}

function exportTotalsCSV() {
  const monthStart = new Date(summaryYear, summaryMonth, 1).getTime();
  const monthEnd   = new Date(summaryYear, summaryMonth + 1, 1).getTime();
  patients = loadPatients();
  const rows = [["Patient","Total (s)","Total (hh:mm:ss)"]];
  for (const p of patients) {
    const total = loadSessions(p.id).reduce((sum, s) => {
      const t = new Date(s.startTime).getTime();
      return (t >= monthStart && t < monthEnd) ? sum + (s.duration || 0) : sum;
    }, 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    const hms = `${h.toString().padStart(2,"0")}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
    rows.push([p.name, total, hms]);
  }
  const label = new Date(summaryYear, summaryMonth, 1)
    .toLocaleDateString(undefined, { month:"long", year:"numeric" }).replace(" ", "-");
  downloadCSV(rows, `psycho-timer-totals-${label}.csv`);
}

function exportAllCSV() {
  const rows = [["Patient","Date","Start","End","Duration (s)","Notes"]];
  patients = loadPatients();
  for (const p of patients) {
    for (const s of loadSessions(p.id).sort((a,b) => new Date(a.startTime) - new Date(b.startTime))) {
      const start = new Date(s.startTime);
      const end   = new Date(s.endTime);
      rows.push([p.name, start.toLocaleDateString(), start.toLocaleTimeString(),
                 end.toLocaleTimeString(), s.duration || 0, s.notes || ""]);
    }
  }
  downloadCSV(rows, "psycho-timer-all.csv");
}

function downloadCSV(rows, filename) {
  const csv  = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
