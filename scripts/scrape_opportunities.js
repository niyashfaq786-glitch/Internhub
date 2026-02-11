/**
 * Example scraper runner (skeleton)
 * You can fetch opportunities from an API / RSS / HTML page, then upsert into Firestore.
 *
 * This is a STARTER TEMPLATE.
 */
const admin = require("firebase-admin");
const fetch = (...args) => import("node-fetch").then(({default: f}) => f(...args));

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

async function main() {
  // TODO: Replace with your real sources
  const sources = [
    // "https://example.com/opportunities.json"
  ];

  const items = [];

  for (const url of sources) {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fetch failed: " + url);
    const data = await res.json();
    // Map data to your schema
    for (const o of data) {
      items.push({
        type: o.type || "Internship",
        title: o.title,
        company: o.company,
        qualification: "Diploma",
        location: o.location || "Remote",
        tags: o.tags || [],
        valid_from: o.valid_from || null,
        valid_to: o.valid_to || null,
        deadline: o.deadline || null,
        source: url,
        scrapedAt: new Date().toISOString()
      });
    }
  }

  console.log("Scraped items:", items.length);

  // Upsert
  for (const it of items) {
    const id = (it.title + "_" + (it.company||"")).replace(/\W+/g,"_").slice(0,120);
    await db.collection("opportunities").doc(id).set(it, { merge: true });
  }

  console.log("Done.");
}

main().catch(err => { console.error(err); process.exit(1); });
