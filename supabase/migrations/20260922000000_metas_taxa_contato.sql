-- Booking conversion: decision-maker contact → scheduled meeting.
-- Default 100% keeps existing daily dials unchanged.

alter table metas
  add column if not exists taxa_contato numeric not null default 100;
