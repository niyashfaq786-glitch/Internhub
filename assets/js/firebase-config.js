import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/**
 * IMPORTANT:
 * Replace the values below with your Firebase Web App config
 * (Firebase Console → Project Settings → Your apps → Web app).
 */
const firebaseConfig = {
  apiKey: "PASTE_HERE",
  authDomain: "PASTE_HERE",
  projectId: "PASTE_HERE",
  storageBucket: "PASTE_HERE",
  messagingSenderId: "PASTE_HERE",
  appId: "PASTE_HERE"
};

// Main app (normal auth session: admin OR student)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Secondary app (used by Admin to create student Auth accounts without logging out Admin)
export const secondaryApp =
  getApps().find(a => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
export const secondaryAuth = getAuth(secondaryApp);
