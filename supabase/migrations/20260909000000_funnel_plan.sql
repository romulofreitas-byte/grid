-- GRID calculadora: persist the pilot's reverse-funnel plan on the profile.

alter table profiles
  add column if not exists funnel_plan jsonb;
