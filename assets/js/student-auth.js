import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const btnLogin = document.getElementById("btnLogin");
const msg = document.getElementById("msg");

btnLogin.addEventListener("click", async () => {
  const studentId = document.getElementById("student_id").value.trim();  // ✅ your HTML id
  const password = document.getElementById("password").value;

  if (!studentId || !password) {
    msg.textContent = "Enter Student ID and Password";
    return;
  }

  // ✅ Auto add domain
  const email = studentId + "@internhub.com";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html"; // ✅ student dashboard page
  } catch (error) {
    msg.textContent = "Login failed: " + error.message;
  }
});
