-- A deal can have several open next actions. Completing or logging one
-- must not close the others.
drop index if exists crm_activities_one_open;
