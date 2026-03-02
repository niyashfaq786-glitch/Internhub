// supabase/functions/ingest-opportunities/index.ts

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {
    const got = req.headers.get("x-ingest-key") ?? "";
    const expected = Deno.env.get("INTERNHUB_INGEST_KEY") ?? "";

    return json({
        got_len: got.length,
        expected_len: expected.length,
        match: got === expected,
        got_preview: got ? got.slice(0, 6) + "..." + got.slice(-4) : "",
        expected_preview: expected ? expected.slice(0, 6) + "..." + expected.slice(-4) : "",
    });
});