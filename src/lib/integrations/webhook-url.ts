export function isAllowedWebhookUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (host === "169.254.169.254" || host.endsWith(".internal")) return false;
  if (url.protocol === "https:") return true;
  if (
    url.protocol === "http:" &&
    (host === "localhost" || host === "127.0.0.1")
  ) {
    return true;
  }
  return false;
}
