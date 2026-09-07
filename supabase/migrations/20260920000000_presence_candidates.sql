alter table lead_enrichment
  add column if not exists presence_candidates jsonb;
