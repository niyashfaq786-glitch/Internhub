import { auth, db } from "./firebase-config.js";
import { $ } from "./utils.js";
import { onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "../403.html";
});

// Derived student login email (must match upload-students logic)
function studentLoginEmail(studentId) {
  return `${studentId}@internhub.com`.toLowerCase();
}

function renderStudent(id, s) {
  return `
    <div class="card">
      <b>${s.name}</b> <small>(${id})</small><br>
      <small>Login Email: ${s.login_email || studentLoginEmail(id)}</small><br>
      <small>${s.branch} · ${s.college}</small>
      <p>Status: <b>${s.status}</b><br>
      Validity: <b>${s.valid_from}</b> → <b>${s.valid_to}</b></p>

      <label>Extend valid_to (YYYY-MM-DD)</label>
      <input id="new_to" value="${s.valid_to}" />

      <div class="actions">
        <button class="btn" id="btnExtend">Save Validity</button>
        <button class="btn secondary" id="btnDeactivate">Deactivate</button>
        <button class="btn secondary" id="btnActivate">Activate</button>
        <button class="btn secondary" id="btnReset">Send Reset Password Email</button>
        <button class="btn secondary" id="btnDelete">Delete Student (Firestore)</button>
      </div>
      <p><small>Note: Deleting Auth user requires Firebase Console (free plan limitation without Admin SDK).</small></p>
      <p id="opmsg"></p>
    </div>
  `;
}

$("btnSearch").addEventListener("click", async () => {
  $("msg").textContent = "";
  $("results").innerHTML = "";
  try {
    const id = $("q").value.trim();
    if (!id) throw new Error("Enter student ID.");
    const ref = doc(db, "students", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Student not found.");

    const s = snap.data();
    $("results").innerHTML = renderStudent(id, s);

    document.getElementById("btnExtend").onclick = async () => {
      document.getElementById("opmsg").textContent = "";
      try {
        const newTo = document.getElementById("new_to").value.trim();
        await updateDoc(ref, { valid_to: newTo, updatedAt: serverTimestamp() });
        document.getElementById("opmsg").textContent = "Validity updated.";
      } catch (e) {
        document.getElementById("opmsg").textContent = e.message || "Failed.";
      }
    };

    document.getElementById("btnDeactivate").onclick = async () => {
      await updateDoc(ref, { status: "INACTIVE", updatedAt: serverTimestamp() });
      document.getElementById("opmsg").textContent = "Student deactivated.";
    };

    document.getElementById("btnActivate").onclick = async () => {
      await updateDoc(ref, { status: "ACTIVE", updatedAt: serverTimestamp() });
      document.getElementById("opmsg").textContent = "Student activated.";
    };

    document.getElementById("btnReset").onclick = async () => {
      const email = s.login_email || studentLoginEmail(id);
      await sendPasswordResetEmail(auth, email);
      document.getElementById("opmsg").textContent = `Password reset email sent to ${email}.`;
    };

    document.getElementById("btnDelete").onclick = async () => {
      await deleteDoc(ref);
      $("results").innerHTML = "";
      $("msg").textContent = "Student deleted from Firestore. Also delete the Auth user from Firebase Console if needed.";
    };

  } catch (e) {
    $("msg").textContent = e.message || "Error";
  }
});
