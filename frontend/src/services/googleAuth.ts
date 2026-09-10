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
  let res: Response;
  try {
    res = await fetch(apiUrl('/api/auth/google/code'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    const msg = networkErr instanceof Error ? networkErr.message : String(networkErr);
    console.error('[Google Auth] Network error:', msg);
    return { success: false, error: 'Network error. Please try again.' };
  }

  // Read raw body first so we can inspect it on any status code
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return { success: false, error: 'Unexpected server response' };
  }

  // Parse JSON regardless of status so we can extract error/code fields
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(rawText);
  } catch {
    if (!res.ok) {
      console.error(`[Google Auth] Backend error ${res.status} (non-JSON):`, rawText.slice(0, 400));
      return { success: false, error: `Server error (${res.status})` };
    }
  }

  // Always surface the code field — covers USER_BANNED on 403
  const errorCode = (json?.code as string | undefined) ?? '';
  const errorMsg = (json?.error as string | undefined) ?? (json?.message as string | undefined) ?? '';

  if (!res.ok) {
    console.error(`[Google Auth] Backend error ${res.status}:`, { errorCode, errorMsg });
    return {
      success: false,
      error: errorMsg || `Server error (${res.status})`,
      code: errorCode || undefined,
    };
  }

  if (json.needsGender) {
    return {
      success: false,
      needsGender: true,
      profile: json.profile as { firstName: string; email: string },
    };
  }

  if (!json.success) {
    console.error('[Google Auth] Backend returned failure:', { errorCode, errorMsg });
    return {
      success: false,
      error: errorMsg || 'Google sign-in failed',
      code: errorCode || undefined,
    };
  }

  return {
    success: true,
    user: json.user,
    token: json.token as string,
    isNewUser: Boolean(json.isNewUser),
  };
}
