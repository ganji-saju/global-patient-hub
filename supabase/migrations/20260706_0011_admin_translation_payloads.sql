-- Store admin-generated localized copy without replacing the current
-- single-locale columns. Existing routes and package SKUs remain valid.

alter table public.admin_landing_routes
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translation_source_locale varchar(12) not null default 'ko',
  add column if not exists translation_provider varchar(80),
  add column if not exists translated_at timestamptz;

alter table public.admin_package_skus
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists translation_source_locale varchar(12) not null default 'ko',
  add column if not exists translation_provider varchar(80),
  add column if not exists translated_at timestamptz;

create index if not exists admin_landing_routes_translations_gin_idx
on public.admin_landing_routes using gin (translations);

create index if not exists admin_package_skus_translations_gin_idx
on public.admin_package_skus using gin (translations);

comment on column public.admin_landing_routes.translations is
  'Localized route copy keyed by locale. Values may include title, subtitle, intent, searchTheme, cta, and secondaryCta.';
comment on column public.admin_package_skus.translations is
  'Localized package copy keyed by locale. Values may include shortTitle, recoveryWindow, bestFor, includes, and complianceNote.';
