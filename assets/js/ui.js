import { loginStudent, loginAdmin, getRole, logout } from "./auth.js";
import { toast, subscribeRealtimeNotifications, loadNotificationsIntoDropdown } from "./notifications.js";
import { loadRecommendedOps, apply, loadMyApplications, uploadPhoto, uploadResume } from "./student.js";
import { listStudents, listApplications, updateApplicationStatus } from "./admin.js";

export async function bootUI() {
  // Attach global functions used by your HTML
  window.handleLogin = async function(e, type) {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    try {
      if (type === "student") {
        const studentId = e.target.querySelector('input[type="text"]').value;
        const password = e.target.querySelector('input[type="password"]').value;
        await loginStudent(studentId, password);
      } else {
        const email = e.target.querySelector('input[type="email"]').value;
        const password = e.target.querySelector('input[type="password"]').value;
        await loginAdmin(email, password);
      }

      const role = await getRole();
      if (role.type === "STUDENT") window.navTo("student");
      else if (role.type === "ADMIN") window.navTo("admin");
      else throw new Error("Account exists but role not assigned");

      toast({ title: "Login Success", message: "Welcome to InternHub", type: "SUCCESS" });
    } catch (err) {
      toast({ title: "Login Failed", message: err.message || "Try again", type: "DANGER" });
    } finally {
      btn.innerHTML = original;
    }
  };

  window.doLogout = async function() {
    await logout();
    window.navTo("landing");
    toast({ title: "Logged out", message: "See you again!", type: "INFO" });
  };

  // Realtime notifications
  await subscribeRealtimeNotifications(async (n) => {
    toast({ title: n.title, message: n.message, type: n.type });
    const dd = document.getElementById("std-notif");
    if (dd) await loadNotificationsIntoDropdown(dd);
  });

  // If already logged in, auto route
  const role = await getRole();
  if (role.type === "STUDENT") window.navTo("student");
  if (role.type === "ADMIN") window.navTo("admin");

  // You can call these after page shows:
  window.refreshStudentHome = async function() {
    const recs = await loadRecommendedOps(8);
    // Replace your demo cards: render into .job-grid
    const grid = document.querySelector("#std-home .job-grid");
    if (!grid) return;
    grid.innerHTML = "";
    recs.forEach(op => {
      const card = document.createElement("div");
      card.className = "job-card";
      card.innerHTML = `
        <div class="match-score">${op.match_score}% Match</div>
        <div class="job-title">${op.title}</div>
        <div style="font-size:0.85rem;color:#64748b;">${op.company || ""} • ${op.location || ""}</div>
        <div style="margin:12px 0;">${(op.tags||[]).slice(0,4).map(t=>`<span class="tag">${t}</span>`).join("")}</div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;">Apply Now</button>
      `;
      card.querySelector("button").onclick = async () => {
        await apply(op.id);
        toast({ title: "Applied", message: "Application submitted", type: "SUCCESS" });
      };
      grid.appendChild(card);
    });
  };

  window.refreshStudentApplications = async function() {
    const items = await loadMyApplications();
    // You can render to your #std-apps area (timeline) as needed
    console.log("apps", items);
  };

  window.refreshStudentNotifs = async function() {
    const dd = document.getElementById("std-notif");
    if (dd) await loadNotificationsIntoDropdown(dd);
  };

  // Admin panel: fetch lists
  window.refreshAdminStudents = async function() {
    const rows = await listStudents({});
    console.log("students", rows);
  };

  window.refreshAdminApps = async function() {
    const rows = await listApplications({});
    console.log("admin apps", rows);
  };

  window.adminSetAppStatus = async function(appId, status, remarks="") {
    await updateApplicationStatus(appId, status, remarks);
    toast({ title: "Updated", message: `Status set to ${status}`, type: "SUCCESS" });
  };

  // File upload hooks (you will add file inputs in UI)
  window.uploadStudentPhoto = async function(fileInput) {
    const file = fileInput.files?.[0];
    if (!file) return;
    await uploadPhoto(file);
    toast({ title: "Photo Uploaded", message: "Profile photo updated", type: "SUCCESS" });
  };

  window.uploadStudentResume = async function(fileInput) {
    const file = fileInput.files?.[0];
    if (!file) return;
    await uploadResume(file);
    toast({ title: "Resume Uploaded", message: "Resume updated", type: "SUCCESS" });
  };
}

