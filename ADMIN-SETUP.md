# NXT TEAM Control Center

A separate admin application for the NXT TEAM GitHub Pages website, backed by Supabase Auth and Postgres Row Level Security.

## Files
- `admin.html` — sign-in and dashboard shell
- `admin.css` — responsive black/yellow control-center design
- `admin.js` — Supabase Auth, protected data access and dashboard actions
- `supabase/schema.sql` — tables, grants and RLS policies

## One-time setup

1. Open the Supabase project connected to this app: https://supabase.com/dashboard/project/xocizxszrqiexfxculsa
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
3. Go to **Authentication → Users** and create your administrator user with your own email and a strong password. Public signup is not implemented in this admin app.
4. In SQL Editor, run this command after replacing the email with the exact admin email:
   ```sql
   update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
   where email = 'YOUR-ADMIN-EMAIL@example.com';
   ```
5. Sign out and sign back in at `https://anirudhadebbarma031214-commits.github.io/NXT-TEAM/admin.html`.

The browser app contains only the Supabase publishable key. Never put a Supabase service-role or secret key in GitHub, HTML, JavaScript, or any browser environment.

## Security model
- Sign-in uses Supabase Auth email/password.
- The UI verifies the authenticated user and checks trusted `app_metadata.role === "admin"`.
- Postgres RLS independently enforces admin access using the signed JWT's `app_metadata` claim.
- User-editable `user_metadata` is never used for authorization.
- Public visitors may submit collaboration requests and read published projects/active announcements; only admins can read or manage submissions and edit dashboard content.
- No public admin signup or password storage is implemented.

## Important
The existing NXT TEAM website's collaboration form currently copies a request to the visitor's clipboard; it does not submit to a database. The admin inbox will populate once the public form is connected to `nxt_collab_requests`. The settings and announcements are stored securely but need a matching public-site renderer before they appear on the homepage.

GitHub Pages is static hosting. The dashboard requires this Supabase project and a one-time SQL setup before login and data features become active.
