import { auth, db } from "./firebase-config.js";
import { getStudentSession, requireStudentSessionOr403, clearStudentSession, $ } from "./utils.js";
import { scoreOpportunity } from "./ai.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const page = window.location.pathname.split("/").pop();
const studentPagesNeedSession = ["dashboard.html","profile.html","opportunities.html","internships.html","scholarships.html","apply.html"];

if (studentPagesNeedSession.includes(page)) {
  requireStudentSessionOr403();
}

const student = getStudentSession();

if (page === "dashboard.html") {
  $("welcome").textContent = `Welcome, ${student.name} (${student.student_id})`;
  $("validity").textContent = `Validity: ${student.valid_from} to ${student.valid_to}`;

  $("btnLogout").addEventListener("click", async () => {
    clearStudentSession();
    try { await signOut(auth); } catch(_) {}
    window.location.href = "student-login.html";
  });

  // Load opportunities and show top recommendations
  const snap = await getDocs(collection(db, "opportunities"));
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Diploma-only filtering
  const diplomaOnly = all.filter(o => String(o.qualification||"").toLowerCase().includes("diploma"));

  // Score and sort
  const ranked = diplomaOnly
    .map(o => ({ ...o, score: scoreOpportunity(student, o) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, 5);

  $("reco").innerHTML = ranked.length
    ? ranked.map(o => `<div class="card"><b>${o.title}</b><br><small>${o.type} · Deadline: ${o.deadline}</small></div>`).join("")
    : "<p>No recommendations found yet. Ask admin to add opportunities.</p>";
}
