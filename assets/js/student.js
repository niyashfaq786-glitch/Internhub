import { supabase } from "./supabaseClient.js";

function scoreOpportunity(student, op) {
  const skills = new Set(student.skills || []);
  const tags = op.tags || [];
  const matches = tags.filter(t => skills.has(t)).length;
  return Math.min(99, 60 + matches * 10);
}

export async function loadStudentProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("students").select("*").eq("user_id", user.id).single();
  if (error) throw error;
  return data;
}

export async function loadRecommendedOps(limit = 8) {
  const student = await loadStudentProfile();

  const { data: ops, error } = await supabase
    .from("opportunities")
    .select("*")
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw error;

  const ranked = (ops || []).map(op => ({
    ...op,
    match_score: scoreOpportunity(student, op)
  })).sort((a,b) => b.match_score - a.match_score);

  return ranked.slice(0, limit);
}

export async function apply(opportunityId) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("applications").insert({
    student_user_id: user.id,
    opportunity_id: opportunityId,
    status: "SUBMITTED"
  });
  if (error) throw error;
}

export async function loadMyApplications() {
  const { data, error } = await supabase
    .from("applications")
    .select("*, opportunities(*)")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function uploadToBucket(bucket, file) {
  const { data: { user } } = await supabase.auth.getUser();
  const path = `${user.id}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  // NOTE: public URL works only if bucket is public. We keep it private normally.
  // So instead store the path; you can use signed URLs later.
  return { path };
}

export async function uploadPhoto(file) {
  const up = await uploadToBucket("photos", file);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("students").update({ photo_url: up.path }).eq("user_id", user.id);
  if (error) throw error;
}

export async function uploadResume(file) {
  const up = await uploadToBucket("resumes", file);
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("students").update({ resume_url: up.path }).eq("user_id", user.id);
  if (error) throw error;
}
