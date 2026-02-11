import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const KEY = "internhub_admin_profile_v1";

export function getCachedAdminProfile() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; }
}

export async function fetchAdminProfile() {
  const u = auth.currentUser;
  if (!u) return null;
  const ref = doc(db, "admins", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const p = { uid: u.uid, ...snap.data() };
  sessionStorage.setItem(KEY, JSON.stringify(p));
  return p;
}

export function requireAdmin(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "../403.html"; return; }
    let p = getCachedAdminProfile();
    if (!p || p.uid !== user.uid) p = await fetchAdminProfile();
    if (!p || p.status !== "ACTIVE") { window.location.href = "../403.html"; return; }
    onReady(p);
  });
}
