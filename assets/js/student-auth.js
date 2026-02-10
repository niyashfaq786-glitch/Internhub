import { signInWithEmailAndPassword } from
  "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { auth } from "./firebase-config.js";

document.getElementById("loginBtn").addEventListener("click", async () => {
  const studentIdRaw = document.getElementById("studentId").value.trim();
  const password = document.getElementById("password").value;

  const errorEl = document.getElementById("errorMsg");
  errorEl.textContent = "";

  if (!studentIdRaw || !password) {
    errorEl.textContent = "Please enter Student ID and Password.";
    return;
  }

  // ✅ user types only S102, we convert internally
  const studentId = studentIdRaw.toLowerCase();
  const email = `${studentId}@internhub.com`;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (e) {
    errorEl.textContent = "Invalid Student ID or Password.";
  }
});
