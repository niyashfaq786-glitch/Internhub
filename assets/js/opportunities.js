import { auth, db } from "./firebase-config.js";
import { getStudentSession, requireStudentSessionOr403, clearStudentSession, $, todayISO, isBetweenISO } from "./utils.js";
import { scoreOpportunity } from "./ai.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const page = window.location.pathname.split("/").pop();
const studentPagesNeedSession = ["dashboard.html","profile.html","opportunities.html","internships.html","scholarships.html","apply.html"];

if (studentPagesNeedSession.includes(page)) {
  requireStudentSessionOr403();
}

const student = getStudentSession();

function opportunityIsActive(o) {
  const today = todayISO();

  // Prefer explicit validity window if present
  const vf = o.valid_from || o.validFrom;
  const vt = o.valid_to || o.validTo;

  if (vf && vt) return isBetweenISO(today, String(vf), String(vt));

  // Else fall back to deadline if present (YYYY-MM-DD recommended)
  const dl = o.deadline || o.last_date || o.lastDate;
  if (dl) return today <= String(dl);

  // If nothing provided, treat as active
  return true;
}

function diplomaOnly(list) {
  return list.filter(o => String(o.qualification || "").toLowerCase().includes("diploma"));
}


function scopeFilter(list) {
  if (!student) return list;
  const sid = (student.college || "").toLowerCase().replace(/\s+/g,"_");
  const dept = String(student.branch || student.department || "").toLowerCase();
  return list.filter(o => {
    const oc = String(o.college_id || "").toLowerCase();
    const od = String(o.department || "").toLowerCase();
    const collegeOk = !oc || !sid ? true : oc === sid;
    const deptOk = !od || !dept ? true : od === dept;
    return collegeOk && deptOk;
  });
}

function typeFilter(list) {
  if (page === "internships.html") return list.filter(o => String(o.type || "").toLowerCase().includes("intern"));
  if (page === "scholarships.html") return list.filter(o => String(o.type || "").toLowerCase().includes("scholar"));
  return list;
}

function renderCards(list, targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  el.innerHTML = list.length ? list.map(o => `
    <div class="card job-card">
      <div class="job-header">
        <img class="company-logo" alt="logo" src="${o.logo || "https://picsum.photos/seed/"+encodeURIComponent(o.company||o.title||"internhub")+"/60/60"}">
        <div>
          <h4 style="margin:0;color:var(--secondary)">${o.title || "Untitled"}</h4>
          <div style="font-size:.85rem;color:var(--text-muted)">${o.company || "InternHub"} · ${o.location || "—"} · <b>${o.type || "Opportunity"}</b></div>
        </div>
      </div>

      <div class="job-tags" style="margin:10px 0 14px 0">
        ${(o.tags || o.skills || []).slice(0,5).map(t => `<span>${t}</span>`).join("")}
        ${o.branch ? `<span>${o.branch}</span>` : ""}
      </div>

      <div class="flex justify-between items-center">
        <small style="color:var(--text-muted)">Deadline: <b>${o.deadline || o.valid_to || "—"}</b></small>
        <a class="btn btn-primary btn-sm" href="apply.html?opp=${encodeURIComponent(o.id)}">Apply</a>
      </div>
    </div>
  `).join("") : "<p>No active opportunities right now.</p>";
}

async function loadAllOpportunities() {
  const snap = await getDocs(collection(db, "opportunities"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

if (page === "dashboard.html") {
  $("welcome").textContent = `Welcome, ${student.name} (${student.student_id})`;
  $("validity").textContent = `Validity: ${student.valid_from} to ${student.valid_to}`;

  $("btnLogout").addEventListener("click", async () => {
    clearStudentSession();
    try { await signOut(auth); } catch(_) {}
    window.location.href = "student-login.html";
  });

  // Load active opps and show top AI recommendations
  const all = await loadAllOpportunities();
  const active = scopeFilter(all.filter(opportunityIsActive));
  const diploma = diplomaOnly(active);

  const ranked = diploma
    .map(o => ({ ...o, score: scoreOpportunity(student, o) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, 6);

  $("reco").innerHTML = ranked.length
    ? ranked.map(o => `
      <div class="card">
        <b>${o.title}</b><br>
        <small>${o.type} · ${o.company || "—"} · Deadline: ${o.deadline || o.valid_to || "—"}</small>
        <div style="margin-top:10px">
          <a class="btn btn-primary btn-sm" href="apply.html?opp=${encodeURIComponent(o.id)}">Apply</a>
        </div>
      </div>
    `).join("")
    : "<p>No active diploma opportunities found.</p>";
}

if (["opportunities.html","internships.html","scholarships.html"].includes(page)) {
  const all = await loadAllOpportunities();
  const active = scopeFilter(all.filter(opportunityIsActive));
  const filtered = typeFilter(diplomaOnly(active));
  renderCards(filtered, "list");
}
