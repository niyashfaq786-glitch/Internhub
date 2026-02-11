/**
 * Firebase Cloud Functions (skeleton)
 * Requires Blaze plan to deploy functions.
 *
 * Features:
 * 1) Auto create admin after approval + email credentials
 * 2) Scheduled cleanup of expired students/opportunities
 *
 * Setup:
 * 1) firebase init functions
 * 2) Put this code into functions/index.js
 * 3) Add SendGrid/SMTP secrets
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// --- Email helper (SMTP) ---
// Set secrets:
// firebase functions:config:set smtp.host="smtp.gmail.com" smtp.port="587" smtp.user="you@domain.com" smtp.pass="APP_PASSWORD" smtp.from="InternHub <you@domain.com>"
// Then deploy functions.
function mailer() {
  const cfg = functions.config().smtp || {};
  if (!cfg.host || !cfg.user || !cfg.pass) return null;
  return nodemailer.createTransport({
    host: cfg.host,
    port: Number(cfg.port || 587),
    secure: false,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

async function sendMail(to, subject, html) {
  const t = mailer();
  if (!t) {
    console.log("SMTP not configured. Skipping email to:", to, subject);
    return;
  }
  const cfg = functions.config().smtp || {};
  await t.sendMail({
    from: cfg.from || cfg.user,
    to,
    subject,
    html,
  });
}


// --- 1) On admin request APPROVED -> create Auth user + admins doc ---
// Trigger when admin updates request status to APPROVED and tempPassword exists.
exports.onAdminRequestApproved = functions.firestore
  .document("admin_requests/{reqId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return null;
    if (after.status !== "APPROVED") return null;
    if (!after.email || !after.tempPassword) return null;

    // Create auth user
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email: after.email,
        password: after.tempPassword,
        displayName: after.name || "Admin",
      });
    } catch (e) {
      console.log("createUser failed:", e.message);
      return null;
    }

    // Create admins/{uid}
    await db.collection("admins").doc(userRecord.uid).set({
      email: after.email,
      role: after.role || "ADMIN",
      department: after.department || "",
      college_name: after.college_name || after.organization || "",
      college_id: after.college_id || (after.college_name || after.organization || "").toLowerCase().replace(/\s+/g,"_"),
      status: "ACTIVE",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    await sendMail(after.email, "InternHub Admin Access Approved", `
      <p>Hello ${after.name || "Admin"},</p>
      <p>Your InternHub admin access is approved.</p>
      <p><b>Login:</b> ${after.email}<br><b>Temporary Password:</b> ${after.tempPassword}</p>
      <p>Please login and change your password.</p>
    `);
    // IMPORTANT: remove tempPassword after sending
    // IMPORTANT: remove tempPassword after sending
    await change.after.ref.update({
      tempPassword: admin.firestore.FieldValue.delete(),
      activatedUid: userRecord.uid,
      activatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  });

// --- 2) Scheduled cleanup (daily) ---
exports.scheduledCleanup = functions.pubsub
  .schedule("every day 01:00")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const iso = today.toISOString().slice(0,10);

    // Opportunities
    const oppSnap = await db.collection("opportunities").get();
    const toDelOpp = [];
    oppSnap.forEach(d => {
      const o = d.data();
      const vf = o.valid_from;
      const vt = o.valid_to;
      if (vf && vt && !(iso >= String(vf) && iso <= String(vt))) toDelOpp.push(d.ref);
      if (!vf && !vt && o.deadline && iso > String(o.deadline)) toDelOpp.push(d.ref);
    });
    for (const ref of toDelOpp) await ref.delete();

    // Students (delete doc + auth user)
    const stuSnap = await db.collection("students").get();
    const toDelStu = [];
    stuSnap.forEach(d => {
      const s = d.data();
      if (s.valid_from && s.valid_to && !(iso >= String(s.valid_from) && iso <= String(s.valid_to))) {
        toDelStu.push({ ref: d.ref, uid: s.uid });
      }
    });

    for (const s of toDelStu) {
      try { if (s.uid) await admin.auth().deleteUser(s.uid); } catch(e) {}
      await s.ref.delete();
    }

    console.log("Cleanup done. Opp:", toDelOpp.length, "Students:", toDelStu.length);
    return null;
  });


// --- 3) HTTPS callable: send student credentials email ---
// Frontend calls this after creating a student, if personal_email exists.
// NOTE: callable requires Firebase Auth; restrict to admins only in Firestore rules OR verify admin in this function.
exports.sendStudentCredentials = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Login required");
  const adminDoc = await db.collection("admins").doc(context.auth.uid).get();
  if (!adminDoc.exists || adminDoc.data().status !== "ACTIVE") {
    throw new functions.https.HttpsError("permission-denied", "Admin only");
  }

  const { to, student_id, login_email, password, college_name, department } = data || {};
  if (!to || !student_id || !login_email || !password) {
    throw new functions.https.HttpsError("invalid-argument", "Missing email/credentials");
  }

  await sendMail(to, "InternHub Student Login Credentials", `
    <p>Hello,</p>
    <p>Your InternHub student account has been created.</p>
    <p><b>Student ID:</b> ${student_id}</p>
    <p><b>Login Email:</b> ${login_email}</p>
    <p><b>Password:</b> ${password}</p>
    <p><b>College:</b> ${college_name || "—"} · <b>Department:</b> ${department || "—"}</p>
    <p>Please login and keep your password safe.</p>
  `);

  return { ok: true };
});
