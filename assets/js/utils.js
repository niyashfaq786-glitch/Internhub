// ---- Simple helpers (beginner friendly) ----
export function $(id) { return document.getElementById(id); }

export function todayISO() {
  const d = new Date();
  d.setHours(0,0,0,0);
  return d.toISOString().slice(0,10); // YYYY-MM-DD
}

export function isBetweenISO(today, from, to) {
  // ISO strings compare safely
  return today >= from && today <= to;
}

// SHA-256 hash using Web Crypto (browser built-in)
export async function sha256(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Session helpers (students not using Firebase auth)
export function setStudentSession(student) {
  sessionStorage.setItem("student_session", JSON.stringify(student));
}
export function getStudentSession() {
  const raw = sessionStorage.getItem("student_session");
  return raw ? JSON.parse(raw) : null;
}
export function clearStudentSession() {
  sessionStorage.removeItem("student_session");
}

export function requireStudentSessionOr403() {
  if (!getStudentSession()) window.location.href = "403.html";
}
