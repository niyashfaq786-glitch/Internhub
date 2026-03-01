// supabase/functions/approve-admin/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function randomPassword(len = 12) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#_";
    let out = "";
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

Deno.serve(async (req) => {
    try {
        if (req.method !== "POST") return json({ error: "POST only" }, 405);

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

        // Client with service role (bypasses RLS, can create users)
        const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

        // Client with anon, but we set user's JWT so we can identify approver safely
        const authHeader = req.headers.get("Authorization") || "";
        const userJwt = authHeader.replace("Bearer ", "");
        if (!userJwt) return json({ error: "Missing Authorization Bearer token" }, 401);

        const userClient = createClient(SUPABASE_URL, ANON_KEY, {
            global: { headers: { Authorization: `Bearer ${userJwt}` } },
        });

        // Verify approver user
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData?.user) return json({ error: "Invalid auth" }, 401);

        const approverId = userData.user.id;

        // Check approver is admin
        const { data: approverAdmin, error: approverAdminErr } = await adminClient
            .from("admins")
            .select("user_id, role, approved")
            .eq("user_id", approverId)
            .maybeSingle();

        if (approverAdminErr || !approverAdmin || !approverAdmin.approved) {
            return json({ error: "Not authorized (admin required)" }, 403);
        }

        const body = await req.json();
        const request_id = String(body.request_id || "");
        const role = String(body.role || "ADMIN");
        const college = body.college ? String(body.college) : null;
        const dept = body.dept ? String(body.dept) : null;

        if (!request_id) return json({ error: "request_id required" }, 400);

        // Load request
        const { data: reqRow, error: reqErr } = await adminClient
            .from("admin_requests")
            .select("*")
            .eq("id", request_id)
            .maybeSingle();

        if (reqErr || !reqRow) return json({ error: "Request not found" }, 404);
        if (reqRow.status !== "PENDING") return json({ error: "Request already decided" }, 400);

        const email = String(reqRow.email).toLowerCase();

        // Create a temp password (we RETURN it to approver to share)
        const tempPassword = randomPassword(12);

        // Create user in Auth
        const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true, // mark confirmed so they can login immediately
        });

        // If user already exists, we can just reset password instead of failing hard
        if (createErr?.message?.toLowerCase().includes("already registered")) {
            // Find existing user by email not directly possible in v2 easily without list.
            // Easiest path: tell admin to use "Forgot password" for that email.
            return json({
                error: "Email already registered. Use Forgot Password or choose another email.",
            }, 409);
        }

        if (createErr || !created?.user) return json({ error: createErr?.message || "Create user failed" }, 500);

        const newUserId = created.user.id;

        // Insert into admins table
        const { error: insErr } = await adminClient.from("admins").insert({
            user_id: newUserId,
            email,
            role: ["SUPER_STATE", "SUPER_COLLEGE", "ADMIN_DEPT", "ADMIN"].includes(role) ? role : "ADMIN",
            college: college ?? reqRow.college ?? null,
            dept: dept ?? reqRow.dept ?? null,
            approved: true,
            approved_by: approverId,
            approved_at: new Date().toISOString(),
        });

        if (insErr) return json({ error: insErr.message }, 500);

        // Mark request approved
        await adminClient.from("admin_requests").update({
            status: "APPROVED",
            decided_at: new Date().toISOString(),
            decided_by: approverId,
        }).eq("id", request_id);

        // Optional: add notification
        await adminClient.from("notifications").insert({
            title: "Admin Approved",
            message: `Approved admin ${email} (${role}).`,
            created_by: approverId,
        });

        return json({
            ok: true,
            email,
            temp_password: tempPassword, // approver can copy and send
            role,
        });
    } catch (e) {
        return json({ error: String(e?.message || e) }, 500);
    }
});