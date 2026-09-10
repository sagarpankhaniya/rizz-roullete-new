import { apiUrl } from '../utils/api';

export type GoogleAuthResult =
  | { success: true; user: unknown; token: string; isNewUser: boolean }
  | { success: false; needsGender: true; profile: { firstName: string; email: string } }
  | { success: false; error?: string; code?: string };

export async function authenticateWithGoogle(body: {
  idToken: string;
  gender?: string;
  interestedIn?: string;
  inviteId?: string;
}): Promise<GoogleAuthResult> {
  let res: Response;
  try {
    res = await fetch(apiUrl('/api/auth/google'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    console.error('[Google Auth] Network error:', networkErr);
    return { success: false, error: 'Network error. Please try again.' };
  }

  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return { success: false, error: 'Unexpected server response' };
  }

  // Parse JSON regardless of status — we need the code/error fields
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(rawText);
  } catch {
    console.error(`[Google Auth] Non-JSON response ${res.status}:`, rawText.slice(0, 200));
    return { success: false, error: `Server error (${res.status})` };
  }

  // NestJS wraps exception messages in { statusCode, message } — normalise both shapes
  const errorCode = (json.code as string | undefined) ?? '';
  const errorMsg =
    (json.error as string | undefined) ??
    (Array.isArray(json.message) ? (json.message as string[])[0] : (json.message as string | undefined)) ??
    '';

  if (!res.ok) {
    console.error(`[Google Auth] Backend ${res.status}:`, { errorCode, errorMsg });
    return {
      success: false,
      error: errorMsg || `Sign-in failed (${res.status})`,
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
