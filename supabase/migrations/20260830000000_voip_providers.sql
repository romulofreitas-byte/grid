-- Native VoIP providers (API4COM, Telnyx). Twilio and Zenvia were already allowed.

alter table integration_connections
  drop constraint if exists integration_connections_provider_chk;

alter table integration_connections
  add constraint integration_connections_provider_chk
  check (provider in (
    'webhook', 'pipedrive', 'hubspot', 'rdstation', 'kommo', 'salesforce',
    '3cplus', 'megadialer', 'twilio', 'zenvia', 'asterisk',
    'api4com', 'telnyx'
  ));
