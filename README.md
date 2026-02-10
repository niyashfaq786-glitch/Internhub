# InternHub (Firebase + GitHub Pages)

## 1) Firebase setup (FREE plan)
1. Create Firebase project
2. Enable **Authentication → Email/Password**
3. Create your **Admin user** in Authentication.
4. Firestore → create collection `admins`
   - Document ID = **Admin Auth UID**
   - Fields: `email` (string), `role` (string="admin"), `status` (string="ACTIVE"), `createdAt` (timestamp)
5. Firestore → create collections: `students`, `opportunities`, `admin_requests`
6. Paste rules from `FIRESTORE_RULES.txt` into Firestore Rules → Publish.

## 2) Create Firebase Web App config
Firebase Console → Project Settings → Your apps → Web app → copy config.
Paste it into:
`assets/js/firebase-config.js` (replace PASTE_HERE values)

## 3) Student account creation (Excel Upload)
Admin Dashboard → Upload Students.
Excel required columns:
- student_id, name, password, branch, college, valid_from, valid_to
Optional:
- email

**Date format must be** YYYY-MM-DD

When uploading:
- A Firebase Auth student user is created with email: `${student_id}@internhub.com`
- Student logs in using Student ID + password (UI converts ID to that email)

## 4) Run locally
Use a local server (recommended):
- VS Code Live Server
- or `python -m http.server` (if available)

## 5) Deploy to GitHub Pages
Upload the `internhub/` folder content to a GitHub repo.
Settings → Pages → Deploy from branch.

IMPORTANT:
- GitHub Pages uses HTTPS, so Firebase Auth works.
