import { auth, db, secondaryAuth } from "./firebase-config.js";
import { $ } from "./utils.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

/**
 * Upload Students (Excel) – Secure version (FREE plan friendly)
 * - Admin stays logged in (auth)
 * - For each row, we create a Firebase Auth user using secondaryAuth
 * - Students login with:
 *      email = `${student_id}@internhub.com`
 *      password = (password column from Excel)
 * - Student doc is stored at: students/{student_id} with field uid = Auth UID
 *
 * Required Excel columns:
 *   student_id, name, password, branch, college, valid_from, valid_to
 * Optional columns:
 *   email  (we store it as personal_email)
 *
 * Date format MUST be YYYY-MM-DD
 */

// Guard: must be logged-in admin (Firebase Auth session exists)
onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "../403.html";
});

function requireColumns(row) {
  const cols = ["student_id","name","password","branch","college","valid_from","valid_to"];
  for (const c of cols) if (!(c in row)) throw new Error("Missing column: " + c);
}

function normalizeStudentId(input) {
  const raw = String(input || "").trim();
  const idPart = raw.includes("@") ? raw.split("@")[0] : raw;
  return idPart.trim().toUpperCase();
}

function studentLoginEmail(studentId) {
  return `${studentId}@internhub.com`.toLowerCase();
}

async function createStudentAuth(email, password) {
  // secondaryAuth keeps admin session untouched
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  // Immediately sign out secondary auth so it doesn't keep a student session
  await signOut(secondaryAuth);
  return cred.user.uid;
}

$("btnUpload")?.addEventListener("click", async () => {
  $("msg").textContent = "";
  try {
    const file = $("file").files[0];
    if (!file) throw new Error("Choose an Excel file first.");

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!rows.length) throw new Error("Excel has no rows.");

    let ok = 0, failed = 0;
    const errors = [];

    for (const row of rows) {
      try {
        requireColumns(row);

        const student_id = normalizeStudentId(row.student_id);
        if (!student_id) continue;

        const password = String(row.password);
        if (password.length < 6) throw new Error(`Password must be at least 6 characters for ${student_id}`);

        const login_email = studentLoginEmail(student_id);

        // Create Auth user (student)
        let uid = "";
        try {
          uid = await createStudentAuth(login_email, password);
        } catch (e) {
          // If email already exists, this is a re-upload.
          // We can reuse the existing UID stored in Firestore (if student doc already exists).
          if (String(e.code || "").includes("email-already-in-use") || String(e.message || "").includes("email-already-in-use")) {
            const existingSnap = await getDoc(doc(db, "students", student_id));
            if (existingSnap.exists() && existingSnap.data().uid) {
              uid = existingSnap.data().uid;
            } else {
              throw new Error(
                `Student ${student_id} already exists in Firebase Auth (${login_email}). ` +
                `Delete that Auth user in Firebase Console (Authentication → Users), then re-upload.`
              );
            }
          } else {
            throw new Error(`Auth create failed for ${student_id} (${login_email}): ${e.message}`);
          }
        }

        // Store Firestore student profile (doc id = student_id)
        await setDoc(doc(db, "students", student_id), {
          student_id,
          uid,
          login_email,
          personal_email: String(row.email || "").trim(),
          name: String(row.name).trim(),
          branch: String(row.branch).trim(),
          college: String(row.college).trim(),
          valid_from: String(row.valid_from).trim(), // YYYY-MM-DD
          valid_to: String(row.valid_to).trim(),     // YYYY-MM-DD
          role: "STUDENT",
          status: "ACTIVE",
          skills: [],
          resume_url: "",
          photo_url: "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        ok++;
      } catch (e) {
        failed++;
        errors.push(e.message);
      }
    }

    $("msg").textContent = `Upload complete. Success: ${ok}, Failed: ${failed}` + (errors.length ? `\nFirst error: ${errors[0]}` : "");
  } catch (e) {
    $("msg").textContent = e.message || "Upload failed";
  }
});
