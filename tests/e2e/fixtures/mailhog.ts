// Helpers for interacting with mailhog from Playwright specs.

const MAILHOG_BASE = 'http://localhost:8026';

export interface MailhogMessage {
  To: string[];
  Body: string;
  Subject: string;
  Raw: unknown;
}

/** Fetch the most recent message addressed to `recipient`. Throws if none. */
export async function getLatestEmailTo(recipient: string, timeoutMs = 10_000): Promise<MailhogMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILHOG_BASE}/api/v2/messages`);
    if (res.ok) {
      const data = await res.json() as { items: Array<{
        Content: { Body: string; Headers: Record<string, string[]> };
      }> };
      for (const item of data.items) {
        const to = item.Content.Headers.To ?? [];
        if (to.some(addr => addr.includes(recipient))) {
          return {
            To: to,
            Body: item.Content.Body,
            Subject: (item.Content.Headers.Subject ?? [''])[0],
            Raw: item,
          };
        }
      }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`No mailhog message for ${recipient} within ${timeoutMs}ms`);
}

/** Extract the 6-digit code from an email body. */
export function extract6DigitCode(body: string): string {
  const match = body.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No 6-digit code in body: ${body.slice(0, 200)}`);
  return match[1];
}

/** Clear mailhog's inbox. Useful in beforeEach for isolation. */
export async function clearMailhogInbox(): Promise<void> {
  await fetch(`${MAILHOG_BASE}/api/v1/messages`, { method: 'DELETE' });
}
