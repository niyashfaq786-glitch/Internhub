/**
 * Cleanup expired students + opportunities (Firebase Admin SDK)
 * Run locally on your PC (NOT in browser).
 *
 * Steps:
 * 1) npm init -y
 * 2) npm i firebase-admin
 * 3) Download Firebase service account JSON:
 *    Firebase Console → Project Settings → Service Accounts → Generate new private key
 * 4) Set env var:
 *    Windows (PowerShell): $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\serviceAccount.json"
 * 5) Run:
 *    node cleanup_expired.js
 */
const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

function todayISO() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10);
}

function isBetweenISO(today, from, to) {
  return today >= from && today <= to;
}

async function main() {
  const today = todayISO();

  // --- Students: delete expired student docs + Auth users ---
  const studentsSnap = await db.collection("students").get();
  const expiredStudents = [];
  for (const doc of studentsSnap.docs) {
    const s = doc.data();
    if (!s.valid_from || !s.valid_to) continue;
    if (!isBetweenISO(today, String(s.valid_from), String(s.valid_to))) {
      expiredStudents.push({ id: doc.id, uid: s.uid });
    }
  }

  console.log("Expired students:", expiredStudents.length);
  for (const s of expiredStudents) {
    try {
      if (s.uid) await admin.auth().deleteUser(s.uid);
    } catch (e) {
      console.log("Auth delete failed for", s.id, e.message);
    }
    await db.collection("students").doc(s.id).delete();
  }

  // --- Opportunities: delete expired ---
  const oppSnap = await db.collection("opportunities").get();
  const expiredOpps = [];
  for (const doc of oppSnap.docs) {
    const o = doc.data();
    const vf = o.valid_from;
    const vt = o.valid_to;
    if (vf && vt && !isBetweenISO(today, String(vf), String(vt))) expiredOpps.push(doc.id);
    if (!vf && !vt && o.deadline && today > String(o.deadline)) expiredOpps.push(doc.id);
  }

  console.log("Expired opportunities:", expiredOpps.length);
  for (const id of expiredOpps) {
    await db.collection("opportunities").doc(id).delete();
  }

  console.log("Done.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
