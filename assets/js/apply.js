import { db } from "./firebase-config.js";
import { requireStudentSessionOr403, getStudentSession, todayISO } from "./utils.js";
import {
  doc, getDoc,
  collection, addDoc,
  query, where, orderBy, getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

requireStudentSessionOr403();
const student = getStudentSession();

const params = new URLSearchParams(window.location.search);
const oppId = params.get("opp");

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
  const o = { id: snap.id, ...snap.data() };
  document.getElementById("oppTitle").textContent = o.title || "Opportunity";
  document.getElementById("oppMeta").textContent = `${o.type || "Opportunity"} · ${o.company || "InternHub"} · Deadline: ${o.deadline || o.valid_to || "—"}`;
  return o;
}

async function listApplications() {
  const el = document.getElementById("apps");
  const q = query(
    collection(db, "applications"),
    where("student_uid", "==", student.uid),
    orderBy("applied_at", "desc")
  );
  const snap = await getDocs(q);
  const apps = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  el.innerHTML = apps.length ? apps.map(a => `
    <div class="card">
      <b>${a.title}</b><br>
      <small>Status: <b>${a.status}</b> · Applied: ${a.applied_date}</small>
    </div>
  `).join("") : "<p>No applications yet.</p>";
}

async function applyNow(o) {
  const msg = document.getElementById("msg");
  msg.textContent = "";

  try {
    // Prevent duplicate apply for same opportunity
    const dq = query(
      collection(db, "applications"),
      where("student_uid", "==", student.uid),
      where("opp_id", "==", o.id)
    );
    const ds = await getDocs(dq);
    if (!ds.empty) {
      msg.textContent = "You already applied to this opportunity.";
      return;
    }

    await addDoc(collection(db, "applications"), {
      student_uid: student.uid,
      student_id: student.student_id,
      student_name: student.name,
      student_branch: student.branch || student.department || "",
      college: student.college || "",
      college_id: (student.college || "").toLowerCase().replace(/\s+/g,"_"),
      opp_id: o.id,
      title: o.title || "Opportunity",
      company: o.company || "InternHub",
      type: o.type || "Opportunity",
      status: "SUBMITTED",
      applied_date: todayISO(),
      applied_at: serverTimestamp(),
    });

    msg.textContent = "Application submitted!";
    await listApplications();
  } catch (e) {
    msg.textContent = e.message || "Failed to apply.";
  }
}

const o = await loadOpportunity();
document.getElementById("btnApply").addEventListener("click", async () => {
  if (!o) return;
  await applyNow(o);
});

await listApplications();
