import { auth, db } from "./firebase-config.js";
import { requireAdmin } from "./admin-context.js";
import { toast } from "./utils.js";
import {
  collection, getDocs, query, orderBy, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let ADMIN = null;
let ALL = [];

function withinScope(admin, a) {
  if (admin.role === "SUPER") return true;
  const sameCollege = !admin.college_id || !a.college_id ? true : admin.college_id === a.college_id;
  const sameDept = !admin.department ? true : (String(a.student_branch||"" ).toLowerCase() === String(admin.department).toLowerCase());
  return sameCollege && sameDept;
}

function normalizeType(t) {
  const x = String(t || "").toUpperCase();
  if (x.includes("SCHOLAR")) return "SCHOLARSHIP";
  if (x.includes("INTERN")) return "INTERNSHIP";
  return x || "—";
}

function row(a) {
  const type = normalizeType(a.type);
  return `
    <div class="row">
      <div>
        <b>${a.title || "—"}</b>
        <div class="muted">${a.company || "—"} · ${type}</div>
        <div class="muted">Student: ${a.student_name || a.student_id || "—"} · ${a.student_branch || "—"} · Applied: ${a.applied_date || "—"}</div>
      </div>
      <div class="row-actions">
        <select class="input" style="width:170px" data-status="${a.id}">
          ${["SUBMITTED","PENDING","APPROVED","SHORTLISTED","SELECTED","REJECTED","HIRED"].map(s => `<option ${String(a.status||"SUBMITTED").toUpperCase()===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
    </div>
  `;
}

async function load() {
  const text = (document.getElementById("q").value || "").toLowerCase().trim();
  const fStatus = (document.getElementById("fStatus").value || "").toUpperCase().trim();
  const fType = (document.getElementById("fType").value || "").toUpperCase().trim();
  const fDept = (document.getElementById("fDept").value || "").trim();

  const snap = await getDocs(query(collection(db, "applications"), orderBy("applied_at", "desc")));
  ALL = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(a => withinScope(ADMIN, a));

  // Build dept dropdown
  const depts = Array.from(new Set(ALL.map(a => String(a.student_branch||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const deptSel = document.getElementById("fDept");
  const current = deptSel.value;
  deptSel.innerHTML = `<option value="">All Departments</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
  if (depts.includes(current)) deptSel.value = current;

  let list = ALL.slice();

  if (text) {
    list = list.filter(a =>
      String(a.title||"").toLowerCase().includes(text) ||
      String(a.company||"").toLowerCase().includes(text) ||
      String(a.student_name||"").toLowerCase().includes(text) ||
      String(a.student_id||"").toLowerCase().includes(text)
    );
  }
  if (fStatus) list = list.filter(a => String(a.status||"SUBMITTED").toUpperCase() === fStatus);
  if (fType) list = list.filter(a => normalizeType(a.type) === fType);
  if (fDept) list = list.filter(a => String(a.student_branch||"") === fDept);

  const el = document.getElementById("list");
  el.innerHTML = list.length ? list.map(row).join("") : "<p class='muted'>No applications found.</p>";

  document.querySelectorAll("[data-status]").forEach(sel => {
    sel.addEventListener("change", async () => {
      await updateDoc(doc(db, "applications", sel.dataset.status), { status: sel.value });
      toast("Status updated");
    });
  });
}

document.getElementById("btnRefresh").addEventListener("click", load);
["q","fStatus","fType","fDept"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => { clearTimeout(window.__t); window.__t=setTimeout(load, 200); });
  el.addEventListener("change", load);
});

requireAdmin(async (admin) => {
  ADMIN = admin;
  await load();
});
