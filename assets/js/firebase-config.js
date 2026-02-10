import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";

/**
 * IMPORTANT:
 * Replace the values below with your Firebase Web App config
 * (Firebase Console → Project Settings → Your apps → Web app).
 */
const firebaseConfig = {
  apiKey: "AIzaSyCut36kO_jCWOijtvUFj19b0lkFEpUM7ZY",
  authDomain: "internhub-309f2.firebaseapp.com",
  projectId: "internhub-309f2",
  storageBucket: "internhub-309f2.firebasestorage.app",
  messagingSenderId: "436295440111",
  appId: "1:436295440111:web:93775102753eea9bd3ad1a",
};

// Main app (normal auth session: admin OR student)
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Secondary app (used by Admin to create student Auth accounts without logging out Admin)
export const secondaryApp =
  getApps().find(a => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
export const secondaryAuth = getAuth(secondaryApp);
