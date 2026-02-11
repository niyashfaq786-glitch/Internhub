import { auth, db } from "./firebase-config.js";
import { todayISO, isBetweenISO, toast } from "./utils.js";
import { requireAdmin } from "./admin-context.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import {
  collection, addDoc, getDocs, doc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let ADMIN = null;

document.getElementById("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "admin-login.html";
});

function oppIsExpired(o) {
  const today = todayISO();
  const vf = o.valid_from || o.validFrom;
  const vt = o.valid_to || o.validTo;
  if (vf && vt) return !(isBetweenISO(today, String(vf), String(vt)));
  const dl = o.deadline || o.last_date || o.lastDate;
  if (dl) return today > String(dl);
  return false;
}

function withinScope(admin, o) {
  if (admin.role === "SUPER") return true;
  const sameCollege = !admin.college_id || !o.college_id ? true : admin.college_id === o.college_id;
  const sameDept = !admin.department ? true : String(o.department||"" ).toLowerCase() === String(admin.department).toLowerCase();
  return sameCollege && sameDept;
}

async function load() {
  const snap = await getDocs(collection(db, "opportunities"));
  let list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(o => withinScope(ADMIN, o));

  const el = document.getElementById("list");
  if (!list.length) {
    el.innerHTML = "<p class='muted'>No opportunities yet for your scope.</p>";
    return;
  }
  el.innerHTML = list.map(o => `
    <div class="row">
      <div>
        <b>${o.title || "Untitled"}</b>
        <div class="muted">${o.type || "Opportunity"} · ${o.company || "—"} · ${o.location || "—"}</div>
        <div class="muted">Dept: ${o.department || "—"} · College: ${o.college_name || "—"}</div>
        <div class="muted">Valid: ${o.valid_from || "—"} → ${o.valid_to || (o.deadline || "—")}</div>
      </div>
      <div class="row-actions">
        ${oppIsExpired(o) ? `<span class="tag warn">Expired</span>` : `<span class="tag ok">Active</span>`}
        <button class="btn secondary" data-del="${o.id}">Delete</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-del]").forEach(b => {
    b.addEventListener("click", async () => {
      if (!confirm("Delete this opportunity?")) return;
      await deleteDoc(doc(db, "opportunities", b.dataset.del));
      toast("Deleted");
      await load();
    });
  });
}

document.getElementById("btnAdd").addEventListener("click", async () => {
  const msg = document.getElementById("msg");
  msg.textContent = "";
  try {
    const type = document.getElementById("type").value;
    const title = document.getElementById("title").value.trim();
    const company = document.getElementById("company").value.trim();
    const qualification = document.getElementById("qualification").value.trim();
    const location = document.getElementById("location").value.trim();
    const valid_from = document.getElementById("valid_from").value;
    const valid_to = document.getElementById("valid_to").value;

    if (!title || !valid_from || !valid_to) throw new Error("Title + validity dates are required.");

    await addDoc(collection(db, "opportunities"), {
      type,
      title,
      company,
      qualification,
      location,
      valid_from,
      valid_to,

      // Scope
      department: ADMIN.department || "",
      college_name: ADMIN.college_name || "",
      college_id: ADMIN.college_id || "",

      createdByAdminUid: ADMIN.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    msg.textContent = "Opportunity added.";
    toast("Added");
    await load();
  } catch (e) {
    msg.textContent = e.message || "Failed to add.";
  }
});

document.getElementById("btnCleanup").addEventListener("click", async () => {
  // Frontend cleanup: remove expired opportunities from your scope only
  const msg = document.getElementById("msg");
  msg.textContent = "";
  try {
    const snap = await getDocs(collection(db, "opportunities"));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => withinScope(ADMIN, o));
    const expired = list.filter(oppIsExpired);
    for (const o of expired) await deleteDoc(doc(db, "opportunities", o.id));
    msg.textContent = `Cleanup done. Deleted ${expired.length} expired opportunities.`;
    toast("Cleanup done");
    await load();
  } catch (e) {
    msg.textContent = e.message || "Cleanup failed.";
  }
});

requireAdmin(async (admin) => {
  ADMIN = admin;
  await load();
});
