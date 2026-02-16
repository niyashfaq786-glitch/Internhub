import { supabase } from "./supabaseClient.js";

export async function listStudents({ q = "", department = "", status = "" } = {}) {
  let query = supabase.from("students").select("*").order("student_id", { ascending: true });

  if (q) query = query.or(`student_id.ilike.%${q}%,name.ilike.%${q}%`);
  if (department) query = query.eq("department", department);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listApplications({ status = "" } = {}) {
  let q = supabase
    .from("applications")
    .select("*, students(name,student_id,college_id,department), opportunities(title,type)")
    .order("updated_at", { ascending: false });

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function updateApplicationStatus(appId, newStatus, remarks = "") {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("applications").update({
    status: newStatus,
    remarks,
    updated_by: user.id
  }).eq("id", appId);

  if (error) throw error;
  // notification is auto-created by DB trigger
}

export async function addOpportunity(op) {
  const { error } = await supabase.from("opportunities").insert(op);
  if (error) throw error;
}
