import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const SOURCES = [
    { name: "Internshala", type: "internship", url: "https://internshala.com/internships" },
    { name: "Unstop", type: "internship", url: "https://unstop.com/internships" },
    { name: "AICTE", type: "internship", url: "https://internship.aicte-india.org/" },
    { name: "Buddy4Study", type: "scholarship", url: "https://www.buddy4study.com/scholarships" }
];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing env: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const addDaysISO = (days) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
};

function normalizeTags(tags) {
    const out = [];
    for (const raw of (tags || [])) {
        const t = String(raw).trim().toLowerCase();
        if (!t || t.length > 30) continue;
        out.push(t.replace(/\s+/g, "_"));
    }
    return Array.from(new Set(out)).slice(0, 12);
}

function extractDeadlineFromText(text) {
    if (!text) return null;
    const t = String(text).replace(/\s+/g, " ").trim();

    let m = t.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i);
    if (m) {
        const day = String(m[1]).padStart(2, "0");
        const mon = m[2].slice(0, 3).toLowerCase();
        const year = m[3];
        const map = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
        return `${year}-${map[mon]}-${day}`;
    }

    m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
    if (m) {
        const day = String(m[1]).padStart(2, "0");
        const mon = String(m[2]).padStart(2, "0");
        const year = m[3];
        return `${year}-${mon}-${day}`;
    }

    return null;
}

async function collectCards(page, sourceName) {
    return await page.evaluate((sourceName) => {
        const abs = (href) => { try { return new URL(href, location.href).toString(); } catch { return null; } };

        const anchors = Array.from(document.querySelectorAll("a[href]"))
            .map(a => ({ a, href: a.getAttribute("href") || "", text: (a.innerText || "").trim() }))
            .filter(x => x.text.length >= 4);

        const isLikely = (href) => {
            const h = href.toLowerCase();
            if (h.startsWith("mailto:") || h.startsWith("tel:")) return false;
            if (h.includes("internship") || h.includes("scholarship")) return true;
            if (h.includes("/internships/") || h.includes("/scholarships/")) return true;
            if (h.includes("apply") || h.includes("details")) return true;
            return false;
        };

        const candidates = anchors.filter(x => isLikely(x.href)).slice(0, 500);

        const pickText = (root, sels) => {
            for (const s of sels) {
                const el = root.querySelector(s);
                const v = (el?.innerText || "").trim();
                if (v) return v;
            }
            return "";
        };

        const seen = new Set();
        const records = [];

        for (const c of candidates) {
            const url = abs(c.href);
            if (!url || seen.has(url)) continue;

            const card = c.a.closest("article, section, li, div") || c.a;

            const title = c.text || pickText(card, ["h1", "h2", "h3", ".title", "[class*=title]"]);
            const provider = pickText(card, [".company", "[class*=company]", "[class*=org]", "[class*=provider]"]);
            const location = pickText(card, [".location", "[class*=location]", "[class*=city]"]);
            const maybeDeadlineText = pickText(card, ["[class*=deadline]", "[class*=date]", "[class*=end]", "[class*=last]"]);

            const tagEls = Array.from(card.querySelectorAll(".tag,[class*=tag],[class*=skill],[class*=chip]"))
                .map(e => (e.innerText || "").trim()).filter(Boolean).slice(0, 12);

            if (!title) continue;
            const bad = title.toLowerCase();
            if (bad.includes("login") || bad.includes("register") || bad.includes("privacy")) continue;

            seen.add(url);
            records.push({ title, provider, location, url, maybeDeadlineText, tags: tagEls, sourceName });
            if (records.length >= 50) break;
        }

        return records;
    }, sourceName);
}

async function enrichFromDetail(page) {
    return await page.evaluate(() => {
        const title = (document.querySelector("h1")?.innerText || document.querySelector("h2")?.innerText || "").trim();
        const provider =
            (document.querySelector("[class*=company]")?.innerText ||
                document.querySelector("[class*=org]")?.innerText ||
                document.querySelector("[class*=provider]")?.innerText || "").trim();

        const nodes = Array.from(document.querySelectorAll("[class*=date],[class*=deadline],[class*=end],[class*=last]"));
        const dateBits = nodes.map(n => (n.innerText || "").trim()).filter(Boolean).slice(0, 25);

        const textAll = (document.body?.innerText || "").slice(0, 12000);
        return { title, provider, dateBits, textAll };
    });
}

async function scrapeSource(browser, src) {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(src.url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    await page.waitForLoadState("networkidle").catch(() => { });

    for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 1600);
        await page.waitForTimeout(1200);
    }

    const raw = (await collectCards(page, src.name)).slice(0, 25);
    const out = [];

    for (const item of raw) {
        await sleep(700);

        let deadline = extractDeadlineFromText(item.maybeDeadlineText);
        let title = String(item.title).slice(0, 140);
        let provider = (item.provider || src.name).slice(0, 80);

        const dp = await browser.newPage();
        try {
            await dp.goto(item.url, { waitUntil: "domcontentloaded" });
            await dp.waitForTimeout(1200);

            const det = await enrichFromDetail(dp);
            if (det.title && det.title.length >= 6) title = det.title.slice(0, 140);
            if (det.provider && det.provider.length >= 2) provider = det.provider.slice(0, 80);

            for (const b of (det.dateBits || [])) deadline = deadline || extractDeadlineFromText(b);
            deadline = deadline || extractDeadlineFromText(det.textAll);
        } catch { }
        finally { await dp.close().catch(() => { }); }

        deadline = deadline || addDaysISO(30); // fallback (DB needs deadline)

        out.push({
            title,
            type: src.type,
            provider,
            location: (item.location || "India").slice(0, 80),
            tags: normalizeTags([...(item.tags || []), src.type, src.name.toLowerCase()]),
            source: "SCRAPED",
            deadline,
            apply_url: item.url,
            status: "ACTIVE"
        });
    }

    await page.close().catch(() => { });
    return out;
}

async function main() {
    console.log("🚀 InternHub scrape start");
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

    try {
        const rows = [];
        for (const src of SOURCES) {
            try {
                console.log(`\n🔎 ${src.name}: ${src.url}`);
                const got = await scrapeSource(browser, src);
                console.log(`✅ ${src.name}: ${got.length} rows`);
                rows.push(...got);
            } catch (e) {
                console.log(`⚠️ ${src.name} failed: ${e?.message || e}`);
            }
            await sleep(1500);
        }

        const finalRows = rows.filter(r => r.title && r.apply_url && r.deadline).slice(0, 200);

        const { data, error } = await supabase
            .from("opportunities")
            .upsert(finalRows, { onConflict: "apply_url" })
            .select("id");

        if (error) throw error;

        console.log(`🎉 Upserted: ${data?.length || 0}`);
    } finally {
        await browser.close().catch(() => { });
    }
}

main().catch((e) => { console.error("❌ Fatal:", e); process.exit(1); });