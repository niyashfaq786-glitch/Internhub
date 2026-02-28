# InternHub (Public Opportunities + Admin Dashboard)

## What it does
- Public explorer (scholarships + internships)
- Search / filter / sort
- Apply button opens official link
- Admin login only
- Admin can add/edit/delete opportunities
- New admin approval system (request -> approve -> auto-create admin)
- Expired opportunities auto-hidden by DB policy

## Setup
1) Supabase: run SQL (tables + RLS)
2) Create first admin in Auth + admins table
3) Create Edge Function `approve-admin`, add secrets
4) Frontend: set keys in assets/js/config.js
5) Deploy with GitHub Pages