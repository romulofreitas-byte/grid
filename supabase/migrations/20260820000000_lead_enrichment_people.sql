-- Names extracted from the company site during Qualificar.
alter table lead_enrichment add column if not exists people jsonb;
