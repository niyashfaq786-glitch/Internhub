// scripts/sendToFunction.js
// Usage:
// node scripts/sendToFunction.js

const FUNCTION_URL = process.env.INTERNHUB_FUNCTION_URL;
const INGEST_KEY = process.env.INTERNHUB_INGEST_KEY;

if (!FUNCTION_URL || !INGEST_KEY) {
    console.error("Missing env: INTERNHUB_FUNCTION_URL or INTERNHUB_INGEST_KEY");
    process.exit(1);
}

async function main() {
    const { execSync } = await import("node:child_process");

    // Build JSON payload from another script:
    const payload = execSync("node scripts/buildPayload.js", { encoding: "utf8" });

    const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // IMPORTANT: must match what your Edge Function checks:
            "x-ingest-key": INGEST_KEY,
        },
        body: payload,
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);

    if (!res.ok) process.exit(1);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});