import { APIRequestContext } from '@playwright/test';
import { getLatestEmailTo, extract6DigitCode } from './mailhog';

const BASE_URL = 'http://localhost:8086';

export interface SessionInfo {
  token: string;
  expiration: number;
  username: string;
  email: string;
}

export interface TestUser {
  username: string;
  email: string;
  password: string;
  session: SessionInfo;
}

/** Generate a per-run unique identifier string. */
export function uniqueId(prefix = 'test'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/**
 * Create a confirmed test user via the API. Returns credentials + a live
 * session token ready to inject into localStorage.
 *
 * Does NOT exercise the UI — use this in specs that don't test auth.
 */
export async function createTestUser(
  request: APIRequestContext,
  opts: { password?: string } = {},
): Promise<TestUser> {
  const username = uniqueId('u');
  const email = `${uniqueId('e')}@test.local`;
  const password = opts.password ?? 'TestPass123';

  // 1. Signup
  const signupRes = await request.post(`${BASE_URL}/api/signup.php`, {
    data: { username, password, email },
  });
  if (signupRes.status() !== 200 || (await signupRes.text()).trim() !== 'true') {
    throw new Error(`signup failed: ${await signupRes.text()}`);
  }

  // 2. Pull confirmation code from mailhog
  const mail = await getLatestEmailTo(email);
  const code = extract6DigitCode(mail.Body);

  // 3. Confirm → receive session
  const confirmRes = await request.post(`${BASE_URL}/api/confirm.php`, {
    data: { email, code },
  });
  if (confirmRes.status() !== 200) {
    throw new Error(`confirm failed: ${await confirmRes.text()}`);
  }
  const session = await confirmRes.json() as SessionInfo;
  if (!session.token) {
    throw new Error(`confirm returned no token: ${JSON.stringify(session)}`);
  }

  return { username, email, password, session };
}

/** Delete the scratch account via the API. Safe to call in teardown.
 *  Logs a warning (does NOT throw) so teardown failures don't mask the
 *  spec's real error, but leaked users become visible in the test output.
 */
export async function deleteTestUser(
  request: APIRequestContext,
  user: TestUser,
): Promise<void> {
  try {
    const res = await request.post(`${BASE_URL}/api/deleteaccount.php`, {
      data: { token: user.session.token, password: user.password },
    });
    if (res.status() !== 200) {
      console.warn(
        `[test-user] deleteaccount non-200 (${res.status()}) for ${user.username}: ${await res.text().catch(() => '<unreadable>')}`,
      );
      return;
    }
    const body = (await res.text()).trim();
    if (body !== 'true') {
      console.warn(
        `[test-user] deleteaccount unexpected body for ${user.username}: ${body}`,
      );
    }
  } catch (err) {
    console.warn(`[test-user] deleteaccount threw for ${user.username}: ${err}`);
  }
}

/**
 * Inject a SessionInfo into localStorage so the app starts already
 * signed in. MUST be called before page.goto('/').
 */
export async function injectSession(
  page: import('@playwright/test').Page,
  session: SessionInfo,
): Promise<void> {
  await page.addInitScript(
    (s: string) => localStorage.setItem('accessToken', s),
    JSON.stringify(session),
  );
}
