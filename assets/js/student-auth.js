import { auth, db } from "./firebase-config.js";
import { $, todayISO, isBetweenISO, setStudentSession } from "./utils.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

function studentLoginEmail(studentId) {
  return `${studentId}@internhub.com`.toLowerCase();
}

$("btnLogin").addEventListener("click", async () => {
  $("msg").textContent = "";
  try {
    const studentId = $("student_id").value.trim();
    const password = $("password").value;

    if (!studentId || !password) throw new Error("Enter Student ID and password.");

    // Login using Firebase Auth (email derived from student_id)
    const email = studentLoginEmail(studentId);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Fetch student profile by student_id from Firestore
    const ref = doc(db, "students", studentId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // If student doc missing, log out and block
      await signOut(auth);
      throw new Error("Student profile not found. Contact Admin.");
    }

    const s = snap.data();

    // Ensure the logged-in uid matches the stored uid
    if (s.uid !== uid) {
      await signOut(auth);
      throw new Error("Security check failed (UID mismatch). Contact Admin.");
    }

    // role + status check
    if (s.role !== "STUDENT") {
      await signOut(auth);
      throw new Error("Role mismatch. Access denied.");
    }
    if (s.status !== "ACTIVE") {
      await signOut(auth);
      throw new Error("Account not active.");
    }

    // date validity check
    const today = todayISO();
    if (!isBetweenISO(today, s.valid_from, s.valid_to)) {
      await signOut(auth);
      if (today < s.valid_from) throw new Error("Login blocked: validity not started.");
      throw new Error("Account expired. Contact Admin.");
    }

    // Store session for easy access (you can also rely on Firebase auth)
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
