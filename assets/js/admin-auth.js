import { auth, db } from "./firebase-config.js";
import { $ } from "./utils.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

async function checkAdminAndRedirect(user) {
  const ref = doc(db, "admins", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Access denied: not an admin.");
  }
  const data = snap.data();
  if (data.status !== "ACTIVE") {
    await signOut(auth);
    throw new Error("Access denied: admin not ACTIVE.");
  }
  window.location.href = "admin-dashboard.html";
}

const btn = $("btnLogin");
if (btn) {
  btn.addEventListener("click", async () => {
    $("msg").textContent = "";
    try {
      const email = $("email").value.trim();
      const password = $("password").value;
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await checkAdminAndRedirect(cred.user);
    } catch (e) {
      $("msg").textContent = e.message || "Login failed";
    }
  });
}

// Auto redirect if already logged in
onAuthStateChanged(auth, async (user) => {
  const onLoginPage = window.location.pathname.endsWith("admin-login.html");
  if (user && onLoginPage) {
    try { await checkAdminAndRedirect(user); } catch (_) {}
  }
});
