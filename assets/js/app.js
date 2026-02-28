// assets/js/app.js
(function () {
    const cfg = window.INTERNHUB_CONFIG;
    if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_ANON_KEY) {
        console.error("Missing SUPABASE config in assets/js/config.js");
    }

    const supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    // -------------------
    // Helpers
    // -------------------
    const $ = (id) => document.getElementById(id);

    function escapeHtml(str) {
        return String(str || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    function toast(msg, type = "ok") {
        const el = $("toast");
        el.className = "toast show " + (type === "danger" ? "danger" : "ok");
        el.textContent = msg;
        setTimeout(() => el.classList.remove("show"), 2600);
    }

    function navTo(pageId) {
        document.querySelectorAll("main").forEach((m) => m.classList.add("hidden"));
        $("page-" + pageId).classList.remove("hidden");
        closeModal();
        closeOppEditor();
        window.scrollTo(0, 0);
    }

    function scrollToExplorer() {
        const el = $("explorer");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // expose for HTML onclick
    window.navTo = navTo;
    window.scrollToExplorer = scrollToExplorer;

    // -------------------
    // Modal
    // -------------------
    function openModal(type) {
        $("login-modal").classList.add("open");
        if (type) switchAuthType(type);
    }
    function closeModal() {
        $("login-modal").classList.remove("open");
    }
    window.openModal = openModal;
    window.closeModal = closeModal;

    function switchAuthType(type) {
        $("t-admin").classList.toggle("active", type === "admin");
        $("t-request").classList.toggle("active", type === "request");
        $("f-admin").classList.toggle("hidden", type !== "admin");
        $("f-request").classList.toggle("hidden", type !== "request");
    }
    window.switchAuthType = switchAuthType;

    // -------------------
    // Opportunity editor modal
    // -------------------
    function openOppEditor(row = null) {
        $("opp-modal").classList.add("open");
        if (!row) {
            $("op_id").value = "";
            $("op_title").value = "";
            $("op_type").value = "scholarship";
            $("op_provider").value = "";
            $("op_location").value = "";
            $("op_tags").value = "";
            $("op_source").value = "MANUAL";
            $("op_deadline").value = "";
            $("op_apply").value = "";
            $("op_status").value = "ACTIVE";
            return;
        }

        $("op_id").value = row.id || "";
        $("op_title").value = row.title || "";
        $("op_type").value = row.type || "scholarship";
        $("op_provider").value = row.provider || "";
        $("op_location").value = row.location || "";
        $("op_tags").value = (row.tags || []).join(", ");
        $("op_source").value = row.source || "MANUAL";
        $("op_deadline").value = row.deadline || "";
        $("op_apply").value = row.apply_url || "";
        $("op_status").value = row.status || "ACTIVE";
    }

    function closeOppEditor() {
        $("opp-modal").classList.remove("open");
    }

    window.openOppEditor = openOppEditor;
    window.closeOppEditor = closeOppEditor;

    // -------------------
    // Public opportunities
    // -------------------
    let PUBLIC_ALL = [];

    function normalize(s) {
        return String(s || "").toLowerCase().trim();
    }

    function buildLocationOptions(rows) {
        const set = new Set();
        rows.forEach((r) => {
            if (r.location) set.add(r.location.trim());
        });

        const sel = $("locationFilter");
        const current = sel.value;

        sel.innerHTML =
            `<option value="all">All Locations</option>` +
            [...set]
                .sort()
                .map((x) => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`)
                .join("");

        if ([...set].includes(current)) sel.value = current;
    }

    async function loadPublicOpportunities() {
        const { data, error } = await supabaseClient
            .from("opportunities")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error(error);
            toast("Failed to load opportunities", "danger");
            return;
        }

        PUBLIC_ALL = data || [];
        buildLocationOptions(PUBLIC_ALL);
        applyPublicFilters();
    }

    function renderPublic(rows) {
        const grid = $("publicGrid");
        const empty = $("publicEmpty");
        grid.innerHTML = "";

        if (!rows || rows.length === 0) {
            empty.classList.remove("hidden");
            return;
        }
        empty.classList.add("hidden");

        rows.forEach((r) => {
            const badgeClass = r.type === "scholarship" ? "b-sch" : "b-int";
            const badgeText = r.type === "scholarship" ? "Scholarship" : "Internship";
            const src = r.source || "MANUAL";
            const deadline = r.deadline ? r.deadline : "No deadline";
            const tags = (r.tags || []).slice(0, 6);

            grid.insertAdjacentHTML(
                "beforeend",
                `
        <div class="job-card">
          <div class="badge b-src">${escapeHtml(src)}</div>
          <div class="badge ${badgeClass}">${badgeText}</div>

          <div class="job-title">${escapeHtml(r.title || "")}</div>
          <div class="muted" style="font-weight:900;">
            ${escapeHtml(r.provider || "—")} • ${escapeHtml(r.location || "—")}
          </div>

          <div class="meta">
            <span><i class="fa-regular fa-calendar"></i> ${escapeHtml(deadline)}</span>
            <span><i class="fa-solid fa-circle-check"></i> ACTIVE</span>
          </div>

          <div class="tags">
            ${tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
          </div>

          <div class="card-actions">
            <a class="btn btn-primary btn-sm" style="justify-content:center;flex:1;"
               target="_blank" rel="noopener"
               href="${escapeHtml(r.apply_url)}">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> Apply
            </a>
          </div>
        </div>
      `
            );
        });
    }

    function applyPublicFilters() {
        const q = normalize($("q").value);
        const type = $("typeFilter").value;
        const loc = $("locationFilter").value;
        const src = $("sourceFilter").value;
        const sortBy = $("sortBy").value;

        let rows = [...PUBLIC_ALL];

        if (q) {
            rows = rows.filter((r) => {
                const hay = [
                    r.title,
                    r.provider,
                    r.location,
                    r.source,
                    r.type,
                    ...(r.tags || []),
                ]
                    .map(normalize)
                    .join(" | ");
                return hay.includes(q);
            });
        }

        if (type !== "all") rows = rows.filter((r) => r.type === type);
        if (loc !== "all") rows = rows.filter((r) => (r.location || "").trim() === loc);
        if (src !== "all") rows = rows.filter((r) => r.source === src);

        if (sortBy === "latest") {
            rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sortBy === "deadline") {
            rows.sort((a, b) => {
                const ad = a.deadline ? new Date(a.deadline) : new Date("2999-12-31");
                const bd = b.deadline ? new Date(b.deadline) : new Date("2999-12-31");
                return ad - bd;
            });
        } else if (sortBy === "title") {
            rows.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
        }

        renderPublic(rows);
    }

    window.applyPublicFilters = applyPublicFilters;

    // -------------------
    // Admin Auth + Guard
    // -------------------
    let ADMIN_PROFILE = null;

    async function fetchAdminProfile() {
        const { data: session } = await supabaseClient.auth.getSession();
        const uid = session?.session?.user?.id;
        if (!uid) return null;

        const { data, error } = await supabaseClient
            .from("admins")
            .select("id,email,full_name,role,college,is_active")
            .eq("id", uid)
            .maybeSingle();

        if (error) return null;
        if (!data?.is_active) return null;
        return data;
    }

    async function afterAuthChanged() {
        ADMIN_PROFILE = await fetchAdminProfile();

        if (ADMIN_PROFILE) {
            $("btn-admin").classList.add("hidden");
            $("btn-logout").classList.remove("hidden");

            $("adminMeta").textContent = `${ADMIN_PROFILE.full_name || "Admin"} • ${ADMIN_PROFILE.college || "Kerala Polytechnics"
                } • ${ADMIN_PROFILE.email}`;

            $("adminRole").textContent = ADMIN_PROFILE.role || "ADMIN";

            navTo("admin");
            await loadAdminData();
        } else {
            const { data: s } = await supabaseClient.auth.getSession();
            if (s?.session) {
                toast("This account is not approved as admin.", "danger");
                await supabaseClient.auth.signOut();
            }
            navTo("landing");
        }
    }

    async function handleAdminLogin(e) {
        e.preventDefault();
        const btn = $("btnLogin");
        const old = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing in...';

        try {
            const email = $("adminEmail").value.trim();
            const password = $("adminPass").value;

            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;

            toast("Login success", "ok");
            await afterAuthChanged();
            closeModal();
        } catch (err) {
            console.error(err);
            toast(err.message || "Login failed", "danger");
        } finally {
            btn.innerHTML = old;
        }
    }
    window.handleAdminLogin = handleAdminLogin;

    async function logoutAdmin() {
        await supabaseClient.auth.signOut();
        ADMIN_PROFILE = null;
        $("btn-admin").classList.remove("hidden");
        $("btn-logout").classList.add("hidden");
        toast("Logged out", "ok");
        navTo("landing");
    }
    window.logoutAdmin = logoutAdmin;

    // -------------------
    // Admin tabs
    // -------------------
    function switchAdminTab(ev, tab) {
        document.querySelectorAll(".sidebar .nav-item").forEach((x) => x.classList.remove("active"));
        if (ev?.currentTarget) ev.currentTarget.classList.add("active");

        $("adm-overview").classList.toggle("hidden", tab !== "overview");
        $("adm-opps").classList.toggle("hidden", tab !== "opps");
        $("adm-requests").classList.toggle("hidden", tab !== "requests");

        if (tab === "opps") loadAdminOpportunities();
        if (tab === "requests") loadAdminRequests();
    }
    window.switchAdminTab = switchAdminTab;

    async function loadAdminData() {
        await loadAdminStats();
        await loadAdminOpportunities();
        await loadAdminRequests();
    }

    async function loadAdminStats() {
        const { data, error } = await supabaseClient.from("opportunities").select("*");
        if (error) {
            toast("Failed to load stats", "danger");
            return;
        }

        const rows = data || [];
        const todayStr = new Date().toISOString().slice(0, 10);

        const active = rows.filter(
            (r) => r.status === "ACTIVE" && (!r.deadline || r.deadline >= todayStr)
        );
        const sch = active.filter((r) => r.type === "scholarship");
        const intl = active.filter((r) => r.type === "internship");

        $("st-total").textContent = rows.length;
        $("st-active").textContent = active.length;
        $("st-sch").textContent = sch.length;
        $("st-int").textContent = intl.length;
    }

    async function loadAdminOpportunities() {
        const { data, error } = await supabaseClient
            .from("opportunities")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            toast("Failed to load opportunities", "danger");
            return;
        }

        const tbody = $("admOppTbody");
        tbody.innerHTML = "";

        (data || []).forEach((r) => {
            const deadline = r.deadline || "—";
            const stClass = r.status === "ACTIVE" ? "sb-active" : "sb-expired";

            tbody.insertAdjacentHTML(
                "beforeend",
                `
        <tr>
          <td style="font-weight:1000;">${escapeHtml(r.title)}</td>
          <td>${escapeHtml(r.type)}</td>
          <td>${escapeHtml(r.location || "—")}</td>
          <td>${escapeHtml(deadline)}</td>
          <td>${escapeHtml(r.source)}</td>
          <td><span class="status-badge ${stClass}">${escapeHtml(r.status)}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" data-id="${r.id}">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm" data-del="${r.id}">
              <i class="fa-solid fa-trash"></i>
            </button>
          </td>
        </tr>
      `
            );
        });

        // bind buttons
        tbody.querySelectorAll("button[data-id]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const id = btn.getAttribute("data-id");
                const row = (data || []).find((x) => x.id === id);
                openOppEditor(row);
            });
        });

        tbody.querySelectorAll("button[data-del]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-del");
                await deleteOpp(id);
            });
        });
    }

    async function saveOpportunity(e) {
        e.preventDefault();
        const btn = $("btnSaveOpp");
        const old = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

        try {
            const id = $("op_id").value.trim();
            const payload = {
                title: $("op_title").value.trim(),
                type: $("op_type").value,
                provider: $("op_provider").value.trim() || null,
                location: $("op_location").value.trim() || null,
                tags: $("op_tags").value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                source: $("op_source").value,
                deadline: $("op_deadline").value || null,
                apply_url: $("op_apply").value.trim(),
                status: $("op_status").value,
            };

            let res;
            if (id) res = await supabaseClient.from("opportunities").update(payload).eq("id", id);
            else res = await supabaseClient.from("opportunities").insert(payload);

            if (res.error) throw res.error;

            toast("Saved", "ok");
            closeOppEditor();
            await loadAdminStats();
            await loadAdminOpportunities();
            await loadPublicOpportunities();
        } catch (err) {
            console.error(err);
            toast(err.message || "Save failed", "danger");
        } finally {
            btn.innerHTML = old;
        }
    }
    window.saveOpportunity = saveOpportunity;

    async function deleteOpp(id) {
        if (!confirm("Delete this opportunity?")) return;
        const { error } = await supabaseClient.from("opportunities").delete().eq("id", id);
        if (error) {
            toast("Delete failed", "danger");
            return;
        }
        toast("Deleted", "ok");
        await loadAdminStats();
        await loadAdminOpportunities();
        await loadPublicOpportunities();
    }

    // -------------------
    // Admin requests + approval (Edge Function)
    // -------------------
    async function submitAdminRequest(e) {
        e.preventDefault();
        const btn = $("btnReq");
        const old = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';

        try {
            const full_name = $("reqName").value.trim();
            const email = $("reqEmail").value.trim();
            const college = $("reqCollege").value.trim();
            const requested_role = $("reqRole").value;

            const { error } = await supabaseClient
                .from("admin_requests")
                .insert({ full_name, email, college, requested_role, status: "PENDING" });

            if (error) throw error;

            toast("Request submitted for approval", "ok");
            closeModal();
        } catch (err) {
            console.error(err);
            toast(err.message || "Request failed", "danger");
        } finally {
            btn.innerHTML = old;
        }
    }
    window.submitAdminRequest = submitAdminRequest;

    async function loadAdminRequests() {
        const { data, error } = await supabaseClient
            .from("admin_requests")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            toast("Failed to load requests", "danger");
            return;
        }

        const tbody = $("admReqTbody");
        tbody.innerHTML = "";

        (data || []).forEach((r) => {
            const stClass =
                r.status === "PENDING" ? "sb-pending" : r.status === "APPROVED" ? "sb-active" : "sb-expired";

            const actions =
                r.status === "PENDING"
                    ? `
          <button class="btn btn-primary btn-sm" data-appr="${r.id}" data-role="${escapeHtml(
                        r.requested_role || "ADMIN_DEPT"
                    )}">
            <i class="fa-solid fa-check"></i> Approve
          </button>
          <button class="btn btn-danger btn-sm" data-rej="${r.id}">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
        `
                    : `<span class="muted" style="font-weight:1000;">Done</span>`;

            tbody.insertAdjacentHTML(
                "beforeend",
                `
        <tr>
          <td style="font-weight:1000;">${escapeHtml(r.email)}</td>
          <td>${escapeHtml(r.full_name || "—")}</td>
          <td>${escapeHtml(r.college || "—")}</td>
          <td>${escapeHtml(r.requested_role || "ADMIN_DEPT")}</td>
          <td><span class="status-badge ${stClass}">${escapeHtml(r.status)}</span></td>
          <td>${actions}</td>
        </tr>
      `
            );
        });

        tbody.querySelectorAll("button[data-appr]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                await approveRequest(btn.getAttribute("data-appr"), btn.getAttribute("data-role"));
            });
        });

        tbody.querySelectorAll("button[data-rej]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                await rejectRequest(btn.getAttribute("data-rej"));
            });
        });
    }
    window.loadAdminRequests = loadAdminRequests;

    async function approveRequest(request_id, role) {
        try {
            const { data: session } = await supabaseClient.auth.getSession();
            const token = session?.session?.access_token;
            if (!token) return toast("Missing session token", "danger");

            const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/approve-admin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ request_id, action: "APPROVE", role }),
            });

            const out = await res.json();
            if (!res.ok) throw new Error(out.error || "Approve failed");

            toast("Approved + Invite sent", "ok");
            await loadAdminRequests();
        } catch (err) {
            console.error(err);
            toast(err.message || "Approve failed", "danger");
        }
    }

    async function rejectRequest(request_id) {
        try {
            const { data: session } = await supabaseClient.auth.getSession();
            const token = session?.session?.access_token;
            if (!token) return toast("Missing session token", "danger");

            const res = await fetch(`${cfg.SUPABASE_URL}/functions/v1/approve-admin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ request_id, action: "REJECT", note: "Rejected by admin" }),
            });

            const out = await res.json();
            if (!res.ok) throw new Error(out.error || "Reject failed");

            toast("Rejected", "ok");
            await loadAdminRequests();
        } catch (err) {
            console.error(err);
            toast(err.message || "Reject failed", "danger");
        }
    }

    // -------------------
    // Init
    // -------------------
    window.addEventListener("click", (e) => {
        if (e.target === $("login-modal")) closeModal();
        if (e.target === $("opp-modal")) closeOppEditor();
    });

    supabaseClient.auth.onAuthStateChange(async () => {
        await afterAuthChanged();
    });

    async function init() {
        navTo("landing");
        await loadPublicOpportunities();
        await afterAuthChanged();
    }

    init();
})();