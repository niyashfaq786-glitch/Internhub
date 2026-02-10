import { db } from "./firebase-config.js";
import { requireStudentSessionOr403, getStudentSession } from "./utils.js";
import { scoreOpportunity } from "./ai.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

requireStudentSessionOr403();
const student = getStudentSession();

const page = window.location.pathname.split("/").pop();
const listEl = document.getElementById("list");
const qEl = document.getElementById("q");
const btn = document.getElementById("btnSearch");

function pageTypeFilter(opp) {
  if (page === "internships.html") return opp.type === "internship";
  if (page === "scholarships.html") return opp.type === "scholarship";
  return true;
}

function diplomaOnly(opp) {
  return String(opp.qualification || "").toLowerCase().includes("diploma");
}

function matchesQuery(opp, q) {
  if (!q) return true;
  const text = (opp.title + " " + (opp.tags||"") + " " + (opp.branch||"") + " " + (opp.qualification||"")).toLowerCase();
  return text.includes(q.toLowerCase());
}

function render(opp) {
  return `
    <div class="card">
      <b>${opp.title}</b><br>
      <small>${opp.type} · Deadline: ${opp.deadline} · Branch: ${opp.branch || "Any"}</small>
      <div class="actions">
        <a class="btn" href="apply.html?opp=${encodeURIComponent(opp._id)}">Apply</a>
      </div>
    </div>
  `;
}

async function loadAndShow() {
  const snap = await getDocs(collection(db, "opportunities"));
  const all = snap.docs.map(d => ({ _id: d.id, ...d.data() }));

  const q = (qEl?.value || "").trim();

  const filtered = all
    .filter(diplomaOnly)
    .filter(pageTypeFilter)
    .filter(o => matchesQuery(o, q))
    .map(o => ({ ...o, score: scoreOpportunity(student, o) }))
    .sort((a,b) => b.score - a.score);

  listEl.innerHTML = filtered.length
    ? filtered.map(render).join("")
    : "<p>No results found.</p>";
}

btn?.addEventListener("click", loadAndShow);
loadAndShow();
