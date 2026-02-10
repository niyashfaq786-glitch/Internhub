import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

document.getElementById("btnLogin").addEventListener("click", async () => {
  const studentId = document.getElementById("student_id").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");

  const email = studentId + "@internhub.com";

  try {
    await signInWithEmailAndPassword(auth, email, password);

    // ✅ important
    localStorage.setItem("role", "student");

    // ✅ go to student dashboard
    window.location.href = "dashboard.html";
  } catch (e) {
    msg.textContent = "Login failed: " + e.message;
  }
});
