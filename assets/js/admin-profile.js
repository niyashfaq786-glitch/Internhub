import { auth, db } from "./firebase-config.js";
import { $, toast } from "./utils.js";
import { requireAdmin } from "./admin-context.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

let ADMIN = null;

$("btnLogout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "admin-login.html";
});

requireAdmin(async (admin) => {
  ADMIN = admin;

  $("name").value = admin.name || "";
  $("email").value = auth.currentUser?.email || admin.email || "";
  $("phone").value = admin.phone || "";
  $("department").value = admin.department || "";
  $("college_name").value = admin.college_name || "";

  $("btnSave").addEventListener("click", async () => {
    $("msg").textContent = "";
    try {
      const name = $("name").value.trim();
      const phone = $("phone").value.trim();
      const department = $("department").value.trim();
      const college_name = $("college_name").value.trim();
      const college_id = (college_name || "").toLowerCase().replace(/\s+/g,"_");

      await updateDoc(doc(db, "admins", ADMIN.uid), {
        name,
        phone,
        department,
        college_name,
        college_id,
        updatedAt: serverTimestamp()
      });

      toast("Profile updated");
      $("msg").textContent = "Saved.";
    } catch (e) {
      $("msg").textContent = e.message || "Save failed";
    }
  });
});
