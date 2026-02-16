import { supabase } from "./supabaseClient.js";

export function toast({ title, message, type = "INFO" }) {
  const wrap = document.createElement("div");
  wrap.style.position = "fixed";
  wrap.style.right = "20px";
  wrap.style.bottom = "20px";
  wrap.style.zIndex = "99999";
  wrap.style.maxWidth = "360px";

  const card = document.createElement("div");
  card.style.background = "white";
  card.style.border = "1px solid #e2e8f0";
  card.style.borderRadius = "16px";
  card.style.boxShadow = "0 10px 20px rgba(0,0,0,0.12)";
  card.style.padding = "14px 14px";
  card.style.marginTop = "10px";

  const badge = document.createElement("div");
  badge.style.fontWeight = "800";
  badge.style.marginBottom = "6px";
  badge.innerText = title;

  const msg = document.createElement("div");
  msg.style.fontSize = "0.9rem";
  msg.style.color = "#475569";
  msg.innerText = message || "";

  card.appendChild(badge);
  card.appendChild(msg);
  wrap.appendChild(card);
  document.body.appendChild(wrap);

  setTimeout(() => wrap.remove(), 3500);
}

export async function loadNotificationsIntoDropdown(dropdownEl) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("to_user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  dropdownEl.innerHTML = "";
  (data || []).forEach(n => {
    const item = document.createElement("div");
    item.className = "notif-item";
    item.innerHTML = `<strong>${n.title}</strong><br><span style="font-size:0.75rem;color:#64748b;">${n.message || ""}</span>`;
    dropdownEl.appendChild(item);
  });
}

export async function subscribeRealtimeNotifications(onNew) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  return supabase
    .channel("notif-" + user.id)
    .on("postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `to_user_id=eq.${user.id}` },
      (payload) => onNew(payload.new)
    )
    .subscribe();
}
