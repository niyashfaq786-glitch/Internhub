import { db } from "./firebase-config.js";
import { requireStudentSessionOr403, getStudentSession } from "./utils.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

requireStudentSessionOr403();
const student = getStudentSession();

const params = new URLSearchParams(window.location.search);
const oppId = params.get("opp");

const key = `apps_${student.student_id}`;

function loadApps() {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}
function saveApps(list) {
  localStorage.setItem(key, JSON.stringify(list));
}
function renderApps() {
  const apps = loadApps();
  const el = document.getElementById("apps");
  el.innerHTML = apps.length ? apps.map(a => `
    <div class="card">
      <b>${a.title}</b><br>
      <small>Status: <b>${a.status}</b> · Applied: ${a.applied_date}</small>
    </div>
  `).join("") : "<p>No applications yet.</p>";
}

async function loadOpportunity() {
  if (!oppId) {
    document.getElementById("oppTitle").textContent = "No opportunity selected.";
    return null;
  }
  const snap = await getDoc(doc(db, "opportunities", oppId));
  if (!snap.exists()) {
    document.getElementById("oppTitle").textContent = "Opportunity not found.";
    return null;
  }
  const opp = snap.data();
  document.getElementById("oppTitle").innerHTML =
    `<b>${opp.title}</b><br><small>${opp.type} · Deadline: ${opp.deadline}</small>`;
  return { id: oppId, ...opp };
}

const opp = await loadOpportunity();
renderApps();

document.getElementById("btnApply").addEventListener("click", () => {
  document.getElementById("msg").textContent = "";
  if (!opp) {
    document.getElementById("msg").textContent = "No opportunity loaded.";
    return;
  }

  const apps = loadApps();
  const already = apps.find(a => a.oppId === oppId);
  if (already) {
    document.getElementById("msg").textContent = "Already applied.";
    return;
  }

  apps.push({
    oppId,
    title: opp.title,
    status: "Applied",
    applied_date: new Date().toISOString().slice(0,10)
  });
  saveApps(apps);
  document.getElementById("msg").textContent = "Applied successfully (saved locally).";
  renderApps();
});
