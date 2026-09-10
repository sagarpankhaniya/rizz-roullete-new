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
  console.log('[Google Auth] Sending auth code to backend', {
    redirectUri: body.redirectUri,
    hasGender: Boolean(body.gender),
    hasInviteId: Boolean(body.inviteId),
  });

  let res: Response;
  try {
    res = await fetch(apiUrl('/api/auth/google/code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error('[Google Auth] Network error — could not reach backend:', networkErr);
    return { success: false, error: 'Network error. Please try again.' };
  }

  console.log('[Google Auth] Backend response status:', res.status);

  if (res.status === 401 || res.status === 403) {
    let detail = '';
    try {
      const json = await res.json();
      detail = json?.message || json?.error || '';
    } catch { /* ignore */ }
    console.error(`[Google Auth] Backend rejected with ${res.status}:`, detail);
    return { success: false, error: 'Google sign-in failed' };
  }

  let result: Record<string, unknown>;
  try {
    result = await res.json();
  } catch (parseErr) {
    console.error('[Google Auth] Failed to parse backend response:', parseErr);
    return { success: false, error: 'Unexpected server response' };
  }

  if (result.needsGender) {
    console.log('[Google Auth] Backend needs gender for new user');
    return {
      success: false,
      needsGender: true,
      profile: result.profile as { firstName: string; email: string },
    };
  }

  if (!result.success) {
    console.error('[Google Auth] Backend returned failure:', {
      error: result.error,
      code: result.code,
    });
    return {
      success: false,
      error: (result.error as string) ?? 'Google sign-in failed',
      code: result.code as string | undefined,
    };
  }

  const user = result.user as Record<string, unknown> | undefined;
  console.log('[Google Auth] Success — email:', user?.email ?? 'unknown', '| isNewUser:', Boolean(result.isNewUser));

  return {
    success: true,
    user: result.user,
    token: result.token as string,
    isNewUser: Boolean(result.isNewUser),
  };
}
