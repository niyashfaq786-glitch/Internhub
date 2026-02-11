import { auth } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

// Small helper that works across all admin pages.
// If a page has an element with id="btnLogout", we wire it.
// If it has a sidebar item calling window.logoutAdmin(), we also expose that.

export async function logoutAdmin() {
  try { await signOut(auth); } catch (_) {}
  // Clear cached admin profile (admin-context.js)
  try { sessionStorage.removeItem("internhub_admin_profile_v1"); } catch (_) {}
  window.location.href = "admin-login.html";
}

// Expose for inline onclick handlers
window.logoutAdmin = logoutAdmin;

document.getElementById("btnLogout")?.addEventListener("click", logoutAdmin);
