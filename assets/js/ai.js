export function scoreOpportunity(student, opp) {
  // Basic AI-like scoring (FREE, runs in browser)
  const skills = (student.skills || []).map(s => s.toLowerCase());
  const text = (opp.title + " " + (opp.qualification||"") + " " + (opp.tags||"")).toLowerCase();

  let skillMatch = 0;
  for (const sk of skills) if (sk && text.includes(sk)) skillMatch += 1;

  const branchMatch = student.branch && (opp.branch || "").toLowerCase().includes(student.branch.toLowerCase()) ? 2 : 0;
  const diplomaMatch = (opp.qualification || "").toLowerCase().includes("diploma") ? 2 : 0;

  return (skillMatch * 2) + branchMatch + diplomaMatch;
}
