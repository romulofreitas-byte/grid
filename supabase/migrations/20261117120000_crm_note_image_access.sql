-- The note bucket is private. Storage still checks a policy for the
-- service role on this project, and the signed-in user can read their own files.

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    drop policy if exists crm_notes_service on storage.objects;
    create policy crm_notes_service
      on storage.objects
      for all
      to service_role
      using (bucket_id = 'crm-notes')
      with check (bucket_id = 'crm-notes');

    drop policy if exists crm_notes_owner_read on storage.objects;
    create policy crm_notes_owner_read
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'crm-notes'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );

    drop policy if exists crm_notes_owner_insert on storage.objects;
    create policy crm_notes_owner_insert
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'crm-notes'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );

    drop policy if exists crm_notes_owner_delete on storage.objects;
    create policy crm_notes_owner_delete
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'crm-notes'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;
end $$;
