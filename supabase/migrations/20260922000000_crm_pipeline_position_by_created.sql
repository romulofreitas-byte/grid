-- One-shot: list nichos by inclusion date, newest first.
-- Later drag-reorder still writes position.

with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by created_at desc, id
         ) - 1 as new_position
    from crm_pipelines
)
update crm_pipelines p
   set position = ranked.new_position
  from ranked
 where p.id = ranked.id;
