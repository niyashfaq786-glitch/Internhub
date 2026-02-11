import { auth, db } from "./firebase-config.js";
import { $, todayISO, isBetweenISO, setStudentSession } from "./utils.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

function normalizeStudentId(input) {
  const raw = String(input || "").trim();
  // If user accidentally typed email, keep only the id part
  const idPart = raw.includes("@") ? raw.split("@")[0] : raw;
  return idPart.trim().toUpperCase(); // Firestore docs use S101 style
}

function studentLoginEmail(studentIdNormalized) {
  return `${studentIdNormalized.toLowerCase()}@internhub.com`;
}

$("btnLogin").addEventListener("click", async () => {
  $("msg").textContent = "";
  try {
    const studentId = normalizeStudentId($("student_id").value);
    const password = $("password").value;

    if (!studentId || !password) throw new Error("Enter Student ID and password.");

    // Students type ONLY Student ID. Email is derived internally.
    const email = studentLoginEmail(studentId);

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Fetch student profile by student_id from Firestore (doc id = S101, S102 ...)
    const ref = doc(db, "students", studentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await signOut(auth);
      throw new Error("Student profile not found. Contact Admin.");
    }

    const s = snap.data();

    // role + status check
    if (s.role !== "STUDENT") {
      await signOut(auth);
      throw new Error("Role mismatch. Access denied.");
    }
    if (s.status !== "ACTIVE") {
      await signOut(auth);
      throw new Error("Account not active.");
    }

    // UID check (only if uid exists in Firestore)
    if (s.uid && s.uid !== uid) {
      await signOut(auth);
      throw new Error("Security check failed (UID mismatch). Contact Admin.");
    }

    // date validity check
    const today = todayISO();
    if (!isBetweenISO(today, s.valid_from, s.valid_to)) {
      await signOut(auth);
      if (today < s.valid_from) throw new Error("Login blocked: validity not started.");
      throw new Error("Account expired. Contact Admin.");
    }

    setStudentSession({
      student_id: studentId,
      uid,
      name: s.name,
      branch: s.branch,
      college: s.college,
      skills: s.skills || [],
      valid_from: s.valid_from,
      valid_to: s.valid_to
    });

    window.location.href = "dashboard.html";
  } catch (e) {
    $("msg").textContent = e.message || "Login failed";
  }
});
