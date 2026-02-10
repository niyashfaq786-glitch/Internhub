import { auth, db } from "./firebase-config.js";
import { $ } from "./utils.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { collection, getDocs, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "../403.html";
});

async function loadRequests() {
  $("list").innerHTML = "";
  const snap = await getDocs(collection(db, "admin_requests"));
  const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.status === "PENDING");

  if (!reqs.length) {
    $("list").innerHTML = "<p>No pending requests.</p>";
    return;
  }

  $("list").innerHTML = reqs.map(r => `
    <div class="card">
      <b>${r.name}</b><br>
      <small>${r.email} · ${r.organization}</small>
      <p>${r.reason}</p>
      <div class="actions">
        <button class="btn" data-approve="${r.id}">Mark Approved</button>
        <button class="btn secondary" data-reject="${r.id}">Reject</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", () => mark(btn.dataset.approve, "APPROVED"));
  });
  document.querySelectorAll("[data-reject]").forEach(btn => {
    btn.addEventListener("click", () => mark(btn.dataset.reject, "REJECTED"));
  });
}

async function mark(id, status) {
  $("msg").textContent = "";
  try {
    await updateDoc(doc(db, "admin_requests", id), { status });
    $("msg").textContent =
      status === "APPROVED"
        ? "Marked APPROVED. Now create user in Authentication and add UID to Firestore admins with status ACTIVE."
        : "Rejected.";
    await loadRequests();
  } catch (e) {
    $("msg").textContent = e.message || "Failed.";
  }
}

loadRequests();
