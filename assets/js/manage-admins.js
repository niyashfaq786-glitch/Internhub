import { auth, db } from "./firebase-config.js";
import { $ } from "./utils.js";
import { requireAdmin } from "./admin-context.js";
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let ADMIN = null;

// Require ACTIVE admin profile (not just signed-in user)
requireAdmin((profile) => {
  ADMIN = profile;
  loadRequests();
});

function genTempPassword() {
  // Simple strong-ish temp password generator (12 chars)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#";
  let out = "";
  for (let i=0;i<12;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

async function loadRequests() {
  $("list").innerHTML = "";
  const snap = await getDocs(collection(db, "admin_requests"));
  const reqsAll = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Only show PENDING requests.
  // Scope: SUPER admin sees all; normal admin sees only requests for their college_id.
  const isSuper = (ADMIN?.role || "").toUpperCase() === "SUPER";
  const myCollege = (ADMIN?.college_id || "").toLowerCase();

  const reqs = reqsAll.filter(r => {
    if ((r.status || "").toUpperCase() !== "PENDING") return false;
    if (isSuper) return true;
    const rCollege = String(r.college_id || "").toLowerCase();
    // If request doesn't have college_id, allow only SUPER (avoid Kerala-wide leaks)
    if (!rCollege) return false;
    return myCollege && rCollege === myCollege;
  });

  if (!reqs.length) {
    $("list").innerHTML = "<p class='muted'>No pending requests.</p>";
    return;
  }

  $("list").innerHTML = reqs.map(r => `
    <div class="card">
      <b>${r.name}</b><br>
      <small>${r.email} · ${r.organization || "—"}</small>
      <p>${r.reason || ""}</p>
      <div class="actions">
        <button class="btn" data-approve="${r.id}">Approve</button>
        <button class="btn secondary" data-reject="${r.id}">Reject</button>
      </div>
      <small class="muted">
        Approve will generate a temporary password and mark the request APPROVED.
        (To auto-create admin account + email credentials, use Cloud Function in /functions.)
      </small>
    </div>
  `).join("");

  document.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", () => approve(btn.dataset.approve));
  });
  document.querySelectorAll("[data-reject]").forEach(btn => {
    btn.addEventListener("click", () => mark(btn.dataset.reject, "REJECTED"));
  });
}

async function approve(id) {
  $("msg").textContent = "";
  try {
    const tempPassword = genTempPassword();

    // Store temp password for automation (Cloud Function can read, create auth user, email it, then delete this field)
    await updateDoc(doc(db, "admin_requests", id), {
      status: "APPROVED",
      tempPassword,
      approvedAt: new Date().toISOString()
    });

    $("msg").innerHTML =
      `Approved. Temporary password: <b>${tempPassword}</b><br>
      Next step (manual): Create this admin in Firebase Authentication using email above + this password,
      then create a Firestore doc in <b>admins/{ADMIN_UID}</b> with status ACTIVE.<br>
      Next step (automatic): Deploy the Cloud Function (see README section).`;

    await loadRequests();
  } catch (e) {
    $("msg").textContent = e.message || "Failed.";
  }
}

async function mark(id, status) {
  $("msg").textContent = "";
  try {
    await updateDoc(doc(db, "admin_requests", id), { status });
    $("msg").textContent = status === "REJECTED" ? "Rejected." : "Updated.";
    await loadRequests();
  } catch (e) {
    $("msg").textContent = e.message || "Failed.";
  }
}

// loadRequests is called after requireAdmin resolves
