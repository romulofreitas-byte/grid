import type { IntegrationAdapter } from "./adapter";
import { createApi4comAdapter } from "./api4com-adapter";
import type { IntegrationProvider } from "./schema";
import { createTelnyxAdapter } from "./telnyx-adapter";
import { createTwilioAdapter } from "./twilio-adapter";
import { createWebhookAdapter } from "./webhook-adapter";
import { createZenviaAdapter } from "./zenvia-adapter";

export function adapterFor(provider: IntegrationProvider): IntegrationAdapter {
  switch (provider) {
    case "webhook":
      return createWebhookAdapter();
    case "api4com":
      return createApi4comAdapter();
    case "zenvia":
      return createZenviaAdapter();
    case "twilio":
      return createTwilioAdapter();
    case "telnyx":
      return createTelnyxAdapter();
    default:
      throw new Error(`adapter not implemented: ${provider}`);
  }
}

export function canOriginate(provider: IntegrationProvider): boolean {
  try {
    return typeof adapterFor(provider).originate === "function";
  } catch {
    return false;
  }
}
