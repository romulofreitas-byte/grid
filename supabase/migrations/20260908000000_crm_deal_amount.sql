-- Deal monetary value for the piloto painel (faturado / pipeline aberto).

alter table crm_deals
  add column if not exists amount_cents int;

alter table crm_deals drop constraint if exists crm_deals_amount_cents_chk;
alter table crm_deals
  add constraint crm_deals_amount_cents_chk
  check (
    amount_cents is null
    or (amount_cents >= 0 and amount_cents <= 9999999999)
  );
