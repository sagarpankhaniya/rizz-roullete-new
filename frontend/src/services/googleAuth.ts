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

/**
 * Auth-code flow — send the OAuth2 authorization code to the backend.
 * The backend exchanges it for an ID token using the client secret,
 * then creates/signs in the user. Supports passkeys and all Google
 * authentication methods.
 */
export async function authenticateWithGoogle(body: {
  code: string;
  redirectUri: string;
  gender?: string;
  interestedIn?: string;
  inviteId?: string;
}): Promise<GoogleAuthResult> {
  const res = await fetch(apiUrl('/api/auth/google/code'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    return { success: false, error: 'Google sign-in failed' };
  }

  const result = await res.json();

  if (result.needsGender) {
    return {
      success: false,
      needsGender: true,
      profile: result.profile,
    };
  }

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Google sign-in failed',
      code: result.code,
    };
  }

  return {
    success: true,
    user: result.user,
    token: result.token,
    isNewUser: Boolean(result.isNewUser),
  };
}
