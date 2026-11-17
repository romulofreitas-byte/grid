-- Private screenshots attached to CRM notes.
-- The app uploads and reads them with the service role after checking the deal.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('crm-notes', 'crm-notes', false)
    on conflict (id) do nothing;
  end if;
end $$;
