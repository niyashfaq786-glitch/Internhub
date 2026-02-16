import { supabase } from "./supabaseClient.js";

// --- Helpers ---
function studentIdToEmail(studentIdRaw) {
  const id = (studentIdRaw || "").trim().toLowerCase();
  // S101 -> s101@internhub.com
  return `${id}@internhub.com`;
}

async function getMyRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { type: "NONE" };

  // check admins table
  const { data: adminRow } = await supabase
    .from("admins")
    .select("role,status,college_id,department")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminRow && adminRow.status === "ACTIVE") return { type: "ADMIN", ...adminRow };

  // else student
  const { data: studentRow } = await supabase
    .from("students")
    .select("student_id,name,status,college_id,department,valid_from,valid_to")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentRow) return { type: "STUDENT", ...studentRow };

  return { type: "UNKNOWN" };
}

// --- Login ---
export async function loginStudent(studentId, password) {
  const email = studentIdToEmail(studentId);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function loginAdmin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

// --- Notifications (Realtime) ---
export async function subscribeNotifications(onNewNotif) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // listen to new notifications for this user
  const channel = supabase
    .channel("notif-" + user.id)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `to_user_id=eq.${user.id}` },
      (payload) => onNewNotif(payload.new)
    )
    .subscribe();

  return channel;
}

// --- Example: load student dashboard data ---
export async function loadStudentDashboard() {
  const role = await getMyRole();
  if (role.type !== "STUDENT") throw new Error("Not a student");

  // validity check (simple UI guard; real security = RLS + status)
  if (role.status !== "ACTIVE") throw new Error("Account not active");

  // AI recommended opportunities: simple ranking (tags/skills)
  // (Starter: you can improve later with real scoring)
  const { data: student } = await supabase
    .from("students")
    .select("skills,college_id,department")
    .eq("user_id", (await supabase.auth.getUser()).data.user.id)
    .single();

  const { data: ops } = await supabase
    .from("opportunities")
    .select("*")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(50);

  const skills = new Set(student.skills || []);
  const ranked = (ops || []).map(o => {
    const tags = o.tags || [];
    const matches = tags.filter(t => skills.has(t)).length;
    const score = Math.min(98, 60 + matches * 10);
    return { ...o, match_score: score };
  }).sort((a,b) => b.match_score - a.match_score);

  return ranked.slice(0, 8);
}

// --- Application create ---
export async function applyToOpportunity(opportunityId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");

  const { error } = await supabase.from("applications").insert({
    student_user_id: user.id,
    opportunity_id: opportunityId,
    status: "SUBMITTED"
  });

  if (error) throw error;
}
