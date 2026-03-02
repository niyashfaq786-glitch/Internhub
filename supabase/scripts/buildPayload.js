// scripts/buildPayload.js
// Produces { items: [...] } for the Edge Function

function isoDatePlus(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

const items = [
    {
        title: "Daily Auto Post: Internship Sample",
        type: "internship",
        provider: "InternHub Bot",
        location: "Kerala / Remote",
        tags: ["Auto", "Daily", "Demo"],
        source: "SCRAPED",
        deadline: isoDatePlus(20),
        apply_url: "https://example.com/apply",
        status: "ACTIVE",
    },
    {
        title: "Daily Auto Post: Scholarship Sample",
        type: "scholarship",
        provider: "InternHub Bot",
        location: "Kerala",
        tags: ["Auto", "Scholarship"],
        source: "SCRAPED",
        deadline: isoDatePlus(30),
        apply_url: "https://example.com/scholarship",
        status: "ACTIVE",
    },
];

console.log(JSON.stringify({ items }, null, 2));