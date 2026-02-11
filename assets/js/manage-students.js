import { auth, db, secondaryAuth } from "./firebase-config.js";
import { $, toast } from "./utils.js";
import { requireAdmin } from "./admin-context.js";
import {
  collection, getDocs, query, orderBy, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

function studentLoginEmail(studentId) {
  return `${String(studentId).trim()}@internhub.com`.toLowerCase();
}

function isExpired(validTo) {
  if (!validTo) return false;
  const t = new Date(validTo + "T23:59:59");
  return isFinite(t) && t.getTime() < Date.now();
}

function withinScope(admin, student) {
  // SUPER admins can see everything
  if (admin.role === "SUPER") return true;
  // Department-scoped admins
  const sameCollege = !admin.college_id || !student.college_id ? true : admin.college_id === student.college_id;
  const sameDept = !admin.department ? true : (String(student.branch||"").toLowerCase() === String(admin.department).toLowerCase());
  return sameCollege && sameDept;
}

function badge(text, kind) {
  const cls = kind === "ok" ? "status-badge status-active" : (kind === "warn" ? "status-badge status-pending" : "status-badge");
  return `<span class="${cls}">${text}</span>`;
}

function row(s) {
  const expired = isExpired(s.valid_to);
  const active = (s.status || "ACTIVE") === "ACTIVE";
  return `
    <div class="row">
      <div style="min-width:260px;">
        <b>${s.name || "—"}</b> <span class="muted">(${s.student_id})</span>
        <div class="muted">${s.branch || "—"} · ${s.college || "—"}</div>
        <div class="muted">Login: ${s.login_email || studentLoginEmail(s.student_id)}</div>
        <div class="muted">Personal Email: ${s.personal_email || "—"}</div>
      </div>

      <div style="min-width:220px;">
        <div>Status: ${badge(active ? "ACTIVE" : "INACTIVE", active ? "ok" : "warn")} ${expired ? badge("EXPIRED", "warn") : ""}</div>
        <div class="muted">Valid: <b>${s.valid_from || "—"}</b> → <b>${s.valid_to || "—"}</b></div>
        <div class="muted">Updated: ${s.updatedAt ? new Date(s.updatedAt.seconds ? s.updatedAt.seconds*1000 : s.updatedAt).toLocaleString() : "—"}</div>
      </div>

      <div class="row-actions" style="gap:8px; flex-wrap:wrap;">
        <input class="input" type="date" value="${s.valid_to || ""}" data-vto="${s.student_id}" title="Set valid_to" style="width:165px;">
        <button class="btn sm" data-save="${s.student_id}"><i class="fa-solid fa-floppy-disk"></i></button>
        <button class="btn secondary sm" data-toggle="${s.student_id}">${active ? "Deactivate" : "Activate"}</button>
        <button class="btn secondary sm" data-delete="${s.student_id}">Delete</button>
      </div>
    </div>
  `;
}

let ADMIN = null;
let ALL = [];

async function loadStudents() {
  $("msg").textContent = "";
  $("list").innerHTML = "<p class='muted'>Loading…</p>";

  const snap = await getDocs(query(collection(db, "students"), orderBy("name")));
  ALL = snap.docs.map(d => ({ student_id: d.id, ...d.data() }))
    .filter(s => withinScope(ADMIN, s));

  // Build department filter from visible students
  const depts = Array.from(new Set(ALL.map(s => String(s.branch||"").trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
  const fDept = $("fDept");
  const current = fDept.value;
  fDept.innerHTML = `<option value="">All Departments</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
  if (depts.includes(current)) fDept.value = current;

  applyFilters();
}

function applyFilters() {
  const q = ($("q").value || "").toLowerCase().trim();
  const st = $("fStatus").value;
  const dept = $("fDept").value;
  const vto = $("fValidTo").value; // yyyy-mm-dd

  let list = ALL.slice();

  if (q) {
    list = list.filter(s =>
      String(s.student_id||"").toLowerCase().includes(q) ||
      String(s.name||"").toLowerCase().includes(q) ||
      String(s.personal_email||"").toLowerCase().includes(q)
    );
  }
  if (st) list = list.filter(s => String(s.status||"ACTIVE") === st);
  if (dept) list = list.filter(s => String(s.branch||"") === dept);
  if (vto) list = list.filter(s => (s.valid_to||"") && String(s.valid_to) <= vto);

  $("list").innerHTML = list.length ? list.map(row).join("") : "<p class='muted'>No students match your filters.</p>";

  // Wire actions
  document.querySelectorAll("[data-save]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.save;
      const input = document.querySelector(`[data-vto="${id}"]`);
      const newTo = (input?.value || "").trim();
      if (!newTo) return toast("Choose valid_to date");
      await updateDoc(doc(db, "students", id), { valid_to: newTo, updatedAt: serverTimestamp() });
      toast("Validity updated");
      await loadStudents();
    });
  });

  document.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.toggle;
      const ref = doc(db, "students", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const s = snap.data();
      const next = (s.status || "ACTIVE") === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateDoc(ref, { status: next, updatedAt: serverTimestamp() });
      toast(`Student ${next}`);
      await loadStudents();
    });
  });

  document.querySelectorAll("[data-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.delete;
      if (!confirm(`Delete student ${id} from Firestore? (Auth user may remain)`)) return;
      await deleteDoc(doc(db, "students", id));
      toast("Deleted Firestore student record");
      await loadStudents();
    });
  });
}

// Manual create student
async function addStudentManual() {
  $("m_msg").textContent = "";
  try {
    const student_id = $("m_student_id").value.trim();
    const name = $("m_name").value.trim();
    const password = $("m_password").value;
    const branch = $("m_branch").value.trim();
    const college = $("m_college").value.trim();
    const personal_email = $("m_email").value.trim();
    const valid_from = $("m_valid_from").value;
    const valid_to = $("m_valid_to").value;

    if (!student_id || !name || !password || !branch || !college || !valid_from || !valid_to) {
      throw new Error("Fill all required fields.");
    }
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");

    const login_email = studentLoginEmail(student_id);

    // Create Auth user using secondary auth (keeps admin logged in)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, login_email, password);
    // Important: sign out secondary auth so it doesn't keep a student session
    try { await signOut(secondaryAuth); } catch (_) {}

    // Store student doc
    await setDoc(doc(db, "students", student_id), {
      uid: cred.user.uid,
      student_id,
      name,
      branch,
      college,
      college_id: (college || "").toLowerCase().replace(/\s+/g,"_"),
      status: "ACTIVE",
      valid_from,
      valid_to,
      login_email,
      personal_email: personal_email || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdByAdminUid: ADMIN.uid,
      createdByAdminDept: ADMIN.department || "",
      createdByAdminCollegeId: ADMIN.college_id || ""
    }, { merge: true });

    $("m_msg").innerHTML = `Created student <b>${student_id}</b>. Login email: <b>${login_email}</b>`;
    toast("Student created");
    await loadStudents();
  } catch (e) {
    $("m_msg").textContent = e.message || "Failed";
  }
}

requireAdmin(async (admin) => {
  ADMIN = admin;

  const scope = admin.role === "SUPER"
    ? "Scope: SUPER admin (all colleges & departments)"
    : `Scope: ${admin.department || "Dept"} · ${admin.college_name || admin.college_id || "College"}`;

  $("scopeHint").textContent = scope;

  $("btnRefresh").addEventListener("click", loadStudents);
  ["q","fStatus","fDept","fValidTo"].forEach(id => {
    $(id).addEventListener("input", () => { clearTimeout(window.__t); window.__t=setTimeout(applyFilters, 150); });
    $(id).addEventListener("change", applyFilters);
  });

  $("btnAddStudent").addEventListener("click", addStudentManual);

  $("btnSendEmailHelp").addEventListener("click", () => {
    alert("To auto-send credentials email, deploy Firebase Cloud Function in /functions and set SMTP secrets. Then wire frontend to call it.");
  });

  await loadStudents();
});
