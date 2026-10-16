-- Lookup the VoIP hangup that matches an originate id, for the live call button.

create index if not exists integration_events_inbound_call_idx
  on integration_events (user_id, connection_id, external_id)
  where direction = 'inbound';
