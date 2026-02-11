import { auth, db } from "./firebase-config.js";
import { getStudentSession, requireStudentSessionOr403, $ } from "./utils.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

requireStudentSessionOr403();
const session = getStudentSession();

$("who").textContent = `${session.name} (${session.student_id})`;

async function loadProfile() {
  const snap = await getDoc(doc(db, "students", session.student_id));
  if (!snap.exists()) return;

  const s = snap.data();
  $("branch").value = s.branch || "";
  $("college").value = s.college || "";
  $("skills").value = (s.skills || []).join(", ");
  $("resume").value = s.resume_url || "";
  $("photo").value = s.photo_url || "";
}

function parseSkills() {
  return $("skills").value.split(",").map(x => x.trim()).filter(Boolean);
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // student must be logged in via Firebase Auth
    window.location.href = "student-login.html";
    return;
  }
  if (user.uid !== session.uid) {
    window.location.href = "403.html";
    return;
  }
  await loadProfile();
});

$("btnSaveLocal").textContent = "Save Profile";
$("btnSaveLocal").addEventListener("click", async () => {
  $("msg").textContent = "";
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("Not logged in.");
    if (user.uid !== session.uid) throw new Error("Unauthorized.");

    const ref = doc(db, "students", session.student_id);
    await updateDoc(ref, {
      branch: $("branch").value.trim(),
      college: $("college").value.trim(),
      skills: parseSkills(),
      resume_url: $("resume").value.trim(),
      photo_url: $("photo").value.trim(),
      updatedAt: serverTimestamp()
    });

    $("msg").textContent = "Profile updated successfully.";
  } catch (e) {
    $("msg").textContent = e.message || "Failed to update profile.";
  }
});

// In secure mode, profile updates are direct, so disable request button:
$("btnRequestAdmin").style.display = "none";
