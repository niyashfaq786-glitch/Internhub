import { auth, db } from "./firebase-config.js";
import { $, todayISO, isBetweenISO } from "./utils.js";
import { requireAdmin } from "./admin-context.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let ADMIN = null;

requireAdmin((profile) => {
  ADMIN = profile;
  loadStats();
});

document.getElementById("btnLogout")?.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "admin-login.html";
});

function countStudents(students) {
  const today = todayISO();
  let active = 0, expired = 0;
  for (const s of students) {
    if (s.status === "ACTIVE" && s.valid_from && s.valid_to && isBetweenISO(today, s.valid_from, s.valid_to)) active++;
    else expired++;
  }
  return { active, expired };
}

function countOpps(opps) {
  const today = todayISO();
  let active = 0, expired = 0;
  for (const o of opps) {
    const vf = o.valid_from || o.validFrom;
    const vt = o.valid_to || o.validTo;
    if (vf && vt) {
      if (isBetweenISO(today, String(vf), String(vt))) active++;
      else expired++;
    } else if (o.deadline) {
      if (today <= String(o.deadline)) active++;
      else expired++;
    } else {
      active++;
    }
  }
  return { active, expired };
}

async function loadStats() {
  const [adminsSnap, studentsSnap, oppSnap, reqSnap, appsSnap] = await Promise.all([
    getDocs(collection(db, "admins")),
    getDocs(collection(db, "students")),
    getDocs(collection(db, "opportunities")),
    getDocs(collection(db, "admin_requests")),
    getDocs(collection(db, "applications")),
  ]);

  const admins = adminsSnap.docs.map(d => d.data());
  const students = studentsSnap.docs.map(d => d.data());
  const opps = oppSnap.docs.map(d => d.data());
  const reqsAll = reqSnap.docs.map(d => d.data());
  const apps = appsSnap.docs.map(d => d.data());

  const { active: activeStudents, expired: expiredStudents } = countStudents(students);
  const { active: activeOpps, expired: expiredOpps } = countOpps(opps);
  // Pending admin requests should be scoped:
  // - SUPER admin sees all
  // - Normal admin sees only requests for their college_id
  const isSuper = (ADMIN?.role || "").toUpperCase() === "SUPER";
  const myCollege = (ADMIN?.college_id || "").toLowerCase();
  const pendingReq = reqsAll.filter(r => {
    if ((r.status || "").toUpperCase() !== "PENDING") return false;
    if (isSuper) return true;
    const rCollege = String(r.college_id || "").toLowerCase();
    if (!rCollege) return false;
    return myCollege && rCollege === myCollege;
  }).length;

  $("stats").innerHTML = `
    <p>Total Admins: <b>${admins.length}</b></p>
    <p>Total Students: <b>${students.length}</b></p>
    <p>Active Students: <b>${activeStudents}</b></p>
    <p>Expired/Inactive Students: <b>${expiredStudents}</b></p>
    <hr>
    <p>Active Opportunities: <b>${activeOpps}</b></p>
    <p>Expired Opportunities: <b>${expiredOpps}</b></p>
    <hr>
    <p>Total Applications: <b>${apps.length}</b></p>
    <p>Pending Admin Requests: <b>${pendingReq}</b></p>
  `;
}
