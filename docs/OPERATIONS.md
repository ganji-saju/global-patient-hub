# GCL Operations

GCL stands for global-connected-lab.

## Recommended Architecture

- Frontend: React + Vite static app deployed on Vercel.
- Database: Supabase Postgres table `public.inquiries` for patient leads.
- Security: browser uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; RLS allows anonymous inserts only.
- Source control: push this folder as a fresh GitHub repository, then import that repository in Vercel.

## Supabase Setup

1. Create a new Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Copy the project URL and publishable/anon key.
4. Set Vercel environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_OPS_AUTH_SITE_URL` (`https://gclab.kr` in production)
   - `SUPABASE_SERVICE_ROLE_KEY`

The app will store demo inquiries in browser local storage until those variables are configured.
Internal operations access is email-based through Supabase Auth. After applying migrations, add each allowed admin, partner, and provider email to `public.ops_user_access`.

## v1 Marketplace Design Pack

The current public app uses `public.inquiries` as a simple lead-capture POC. The v1
regulated marketplace design pack is documented under `docs/product/README.md`.
Before full v1 development, follow the seven-gate validation roadmap in
`docs/product/05-validation-roadmap-japan-taiwan-skin-wedge.md`.

After the landing-page validation setup is live, run the closed beta operating
plan in `docs/product/06-closed-beta-operating-plan.md`. That plan defines the
Closed Beta Master Sheet, 5-provider SLA gate, coordinator playbook, 300-lead
test, 15-deposit target, settlement ledger validation, and provider/channel
ranking rules.

Closed beta operating artifacts:

- Workbook source copy: `docs/operations/closed-beta-master-sheet.xlsx`
- Public workbook download: `/beta/closed-beta-master-sheet.xlsx`
- Beta command center: `/admin/beta`
- Case dashboard: `/admin/cases`
- Quote/deposit/booking MVP: `/admin/quote-booking`
- Reservation slot calendar: `/admin/reservation-calendar`
- Provider registration: `/admin/providers`
- Partner/agent registration: `/admin/partners`

Operations role menu matrix:

| Role              | Visible menus                                                                                                     | Hidden menus                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Admin             | 운영 점검, 케이스, 파트너 케이스, 병원 견적, 견적/예약, 예약 캘린더, 병원등록, 에이전트등록, 베타 운영, 랜딩 경로 | None                                                                           |
| Provider/hospital | 병원 견적, 견적/예약, 예약 캘린더                                                                                 | 운영 점검, 케이스, 파트너 케이스, 병원등록, 에이전트등록, 베타 운영, 랜딩 경로 |
| Partner/agency    | 파트너 케이스, 견적/예약, 예약 캘린더                                                                             | 운영 점검, 케이스, 병원 견적, 병원등록, 에이전트등록, 베타 운영, 랜딩 경로     |

Role action boundaries:

- Provider/hospital users can submit their own provider quotes and create their own availability slots.
- Partner/agency users can manage their assigned partner cases and shortlist providers.
- Only admins can register/delete providers or agents, create payment links, queue notifications, place/release temporary holds, and confirm bookings.

For backend implementation, apply the additive core schema migration after the POC schema:

```powershell
supabase/migrations/20260609_0001_core_marketplace_schema.sql
supabase/migrations/20260610_0003_partner_assisted_mvp.sql
supabase/migrations/20260610_0004_partner_mvp_seed.sql
supabase/migrations/20260610_0005_phase2_case_activity_events.sql
supabase/migrations/20260610_0006_admin_ops_persistence.sql
supabase/migrations/20260625_0007_reservation_calendar_holds.sql
supabase/migrations/20260625_0008_ops_email_access.sql
supabase/migrations/20260626_0009_expand_landing_route_markets.sql
supabase/migrations/20260626_0010_admin_package_skus.sql
supabase/migrations/20260706_0011_admin_translation_payloads.sql
```

Those migrations add the provider verification, patient eligibility, case CRM,
matching, quote, booking, payment, compliance, settlement, and reporting tables.
The reservation calendar migration extends slots with case/quote hold ownership
and links scheduled notification outbox rows to bookings.
The operations email migration maps Supabase Auth emails to admin, partner, or provider scopes without issuing manual API tokens.
The landing route expansion migration lets admins save global locale codes and market segments beyond the initial EN/JP Japan/Taiwan wedge.
The package SKU migration lets admins add, edit, and hide package codes used by landing route drafts.
The translation payload migration lets admin route and package records store generated locale-specific copy without exposing translation API keys to the browser.

Example access rows:

```sql
-- First find the real account IDs to scope partner/provider users.
select id, name
from public.partners
order by name;

select id, name_legal, name_display
from public.providers
order by name_legal;

insert into public.ops_user_access (email, role)
values ('admin@example.com', 'admin');

-- Replace the UUID below with an actual id returned from public.partners.
insert into public.ops_user_access (email, role, partner_id)
values ('agency-ops@example.com', 'partner', '11111111-1111-1111-1111-111111111111');

-- Replace the UUID below with an actual id returned from public.providers.
insert into public.ops_user_access (email, role, provider_id)
values ('hospital-ops@example.com', 'provider', '22222222-2222-2222-2222-222222222222');
```

Supabase Auth can send a magic link with the default email template. If you want users to enter the six-digit code in the app, include `{{ .Token }}` in the Supabase email template as well.

For production email sign-in, configure Supabase Auth URL settings:

- Site URL: `https://gclab.kr`
- Additional Redirect URLs:
  - `https://gclab.kr/**`
  - `https://www.gclab.kr/**`
  - `https://gcl-project.vercel.app/**`
  - `https://gcl-ganji-sajus-projects.vercel.app/**`
  - `http://localhost:5173/**` for local Vite testing

If these redirect URLs are missing, Supabase can fall back to a local Site URL such as `http://localhost:3000` after the user clicks the email link.

## Vercel Setup

Use these settings when importing the GitHub repository:

- Framework Preset: Vite
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist/public`

`vercel.json` already includes SPA rewrites so routes like `/hospitals/aura-facial-institute` work after refresh.

## GitHub Publish

```powershell
git init
git add .
git commit -m "Create GCL"
gh repo create gcl --private --source . --remote origin --push
```

Change `--private` to `--public` only when you are ready to expose the code.

## Operating Notes

- Treat listed prices as estimates; final quotes must be confirmed by licensed providers.
- Add spam protection before heavy traffic. Recommended next step: Vercel serverless function or Supabase Edge Function with Turnstile verification before insert.
- Keep the anon key public only with RLS enabled and tested.
- Do not store medical documents in this frontend. Use a private Supabase Storage bucket or CRM workflow for sensitive files.
