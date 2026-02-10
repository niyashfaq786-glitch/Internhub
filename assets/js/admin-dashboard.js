import { auth, db } from "./firebase-config.js";
import { $ } from "./utils.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { collection, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

function mustBeLoggedIn() {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "../403.html";
  });
}

function countActiveExpired(students) {
  const today = new Date(); today.setHours(0,0,0,0);
  const iso = today.toISOString().slice(0,10);
  let active = 0, expired = 0;
  for (const s of students) {
    if (s.status === "ACTIVE" && iso >= s.valid_from && iso <= s.valid_to) active++;
    else expired++;
  }
  return { active, expired };
}

async function loadStats() {
  const [adminsSnap, studentsSnap, oppSnap, reqSnap] = await Promise.all([
    getDocs(collection(db, "admins")),
    getDocs(collection(db, "students")),
    getDocs(collection(db, "opportunities")),
    getDocs(collection(db, "admin_requests")),
  ]);

  const admins = adminsSnap.docs.map(d => d.data());
  const students = studentsSnap.docs.map(d => d.data());
  const opportunities = oppSnap.docs.map(d => d.data());
  const reqs = reqSnap.docs.map(d => d.data());

  const { active, expired } = countActiveExpired(students);
  const pendingReq = reqs.filter(r => r.status === "PENDING").length;

  $("stats").innerHTML = `
    <p>Total Admins: <b>${admins.length}</b></p>
    <p>Total Students: <b>${students.length}</b></p>
    <p>Active Students: <b>${active}</b></p>
    <p>Expired/Inactive Students: <b>${expired}</b></p>
    <p>Opportunities: <b>${opportunities.length}</b></p>
    <p>Pending Admin Requests: <b>${pendingReq}</b></p>
  `;
}

async function addOpportunity() {
  $("msg").textContent = "";
  try {
    const payload = {
      title: $("title").value.trim(),
      type: $("type").value,
      deadline: $("deadline").value.trim(),
      qualification: $("qualification").value.trim(),
      branch: $("branch").value.trim() || "Any",
      tags: $("tags").value.trim(),
      source: "Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (!payload.title || !payload.deadline || !payload.qualification) {
      throw new Error("Title, Deadline, Qualification are required.");
    }
    await addDoc(collection(db, "opportunities"), payload);
    $("msg").textContent = "Opportunity added successfully.";
    await loadStats();
  } catch (e) {
    $("msg").textContent = e.message || "Failed to add opportunity.";
  }
}

mustBeLoggedIn();
loadStats();

$("btnAddOpp")?.addEventListener("click", addOpportunity);

$("btnLogout")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "admin-login.html";
});
