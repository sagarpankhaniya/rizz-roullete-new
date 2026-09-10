import { apiUrl } from '../utils/api';

export type GoogleAuthResult =
  | {
      success: true;
      user: unknown;
      token: string;
      isNewUser: boolean;
    }
  | {
      success: false;
      needsGender: true;
      profile: { firstName: string; email: string };
    }
  | {
      success: false;
      error?: string;
      code?: string;
    };

export async function authenticateWithGoogle(body: {
  code: string;
  redirectUri: string;
  gender?: string;
  interestedIn?: string;
  inviteId?: string;
}): Promise<GoogleAuthResult> {
  alert(`[Google Auth] Sending code to backend\nredirectUri: ${body.redirectUri}\nhasGender: ${Boolean(body.gender)}`);

  let res: Response;
  try {
    res = await fetch(apiUrl('/api/auth/google/code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    alert(`[Google Auth] Network error — could not reach backend:\n${msg}`);
    return { success: false, error: 'Network error. Please try again.' };
  }

  alert(`[Google Auth] Backend response status: ${res.status}`);

  // Read raw body first so we can log it on any error
  let rawText = '';
  try {
    rawText = await res.text();
  } catch (readErr) {
    const msg = readErr instanceof Error ? readErr.message : String(readErr);
    alert(`[Google Auth] Failed to read response body:\n${msg}`);
    return { success: false, error: 'Unexpected server response' };
  }

  if (!res.ok) {
    alert(`[Google Auth] Backend error ${res.status}:\n${rawText.slice(0, 400)}`);
    let detail = '';
    try {
      const json = JSON.parse(rawText);
      detail = json?.message || json?.error || '';
    } catch { /* not JSON */ }
    return { success: false, error: detail || `Server error (${res.status})` };
  }

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(rawText);
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    alert(`[Google Auth] Failed to parse backend JSON:\n${msg}\nraw: ${rawText.slice(0, 200)}`);
    return { success: false, error: 'Unexpected server response' };
  }

  if (result.needsGender) {
    alert('[Google Auth] Backend needs gender for new user');
    return {
      success: false,
      needsGender: true,
      profile: result.profile as { firstName: string; email: string },
    };
  }

  if (!result.success) {
    alert(`[Google Auth] Backend returned failure:\nerror: ${result.error ?? 'none'}\ncode: ${result.code ?? 'none'}`);
    return {
      success: false,
      error: (result.error as string) ?? 'Google sign-in failed',
      code: result.code as string | undefined,
    };
  }

  const user = result.user as Record<string, unknown> | undefined;
  alert(`[Google Auth] Success!\nemail: ${user?.email ?? 'unknown'}\nisNewUser: ${Boolean(result.isNewUser)}`);

  return {
    success: true,
    user: result.user,
    token: result.token as string,
    isNewUser: Boolean(result.isNewUser),
  };
}
