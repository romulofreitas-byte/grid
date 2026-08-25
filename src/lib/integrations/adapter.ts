import type {
  IntegrationKind,
  IntegrationProvider,
  LeadOutbound,
} from "./schema";

export type ConnectionCtx = {
  connectionId: string;
  userId: string;
  provider: IntegrationProvider;
  kind: IntegrationKind;
  /** Field map, campaign id, webhook URL, Salesforce Lead vs Account, etc. */
  config: Record<string, unknown>;
  callerId?: string | null;
  decryptCredentials: () => Promise<Record<string, string>>;
};

export type PushResult = {
  accepted: number;
  failed: number;
  errors: Array<{ cnpj: string; message: string }>;
};

export type OriginateInput = {
  toE164: string;
  from?: string | null;
  cnpj: string;
  searchId: string | null;
};

export type CallResult = {
  accepted: boolean;
  externalId?: string;
  message?: string;
};

export type OutcomeEvent = {
  cnpj?: string;
  e164?: string;
  disposition: string;
  notes?: string;
  durationSec?: number;
  externalId?: string;
  occurredAt?: string;
};

export type IntegrationAdapter = {
  kind: IntegrationKind;
  auth: "oauth" | "api_key" | "connector";
  pushList?(leads: LeadOutbound[], ctx: ConnectionCtx): Promise<PushResult>;
  originate?(call: OriginateInput, ctx: ConnectionCtx): Promise<CallResult>;
  parseInbound?(
    req: Request,
    rawBody: string,
  ): Promise<OutcomeEvent | null>;
  /** Side effects on inbound (e.g. Telnyx bridge agent → lead). */
  ackInbound?(rawBody: string, ctx: ConnectionCtx): Promise<void>;
};
