import { supabase } from "./supabaseClient.js";

export function studentIdToEmail(studentIdRaw) {
  const id = (studentIdRaw || "").trim().toLowerCase();
  return `${id}@internhub.com`;
}

export async function loginStudent(studentId, password) {
  const email = studentIdToEmail(studentId);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function loginAdmin(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function getRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { type: "NONE" };

  // admin?
  const { data: admin } = await supabase.from("admins")
    .select("role,status,college_id,department,email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (admin && admin.status === "ACTIVE") return { type: "ADMIN", ...admin };

  // student?
  const { data: student } = await supabase.from("students")
    .select("student_id,name,status,college_id,department,valid_from,valid_to,skills,branch")
    .eq("user_id", user.id)
    .maybeSingle();

  if (student) return { type: "STUDENT", ...student };

  return { type: "UNKNOWN" };
}
