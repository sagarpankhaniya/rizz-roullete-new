import { apiUrl } from '../utils/api';
import { authHeaders, clearToken } from '../utils/auth';
import {
  clearStoredUser,
  setStoredUser,
  type StoredUser,
} from '../utils/user';

type ApiUserResponse = {
  success?: boolean;
  user?: StoredUser;
  error?: string;
  code?: string;
  message?: string;
};

/**
 * Load the current user with the stored JWT.
 * Returns null if missing/expired token (and clears local session).
 */
export async function fetchProfile(): Promise<StoredUser | null> {
  const res = await fetch(apiUrl('/api/profile'), {
    headers: authHeaders({ Accept: 'application/json' }),
  });

  if (res.status === 401 || res.status === 403) {
    clearToken();
    clearStoredUser();
    return null;
  }

  if (!res.ok) {
    throw new Error(`Profile request failed (${res.status})`);
  }

  const data = (await res.json()) as ApiUserResponse;
  const user = data.user;
  if (!user || typeof user !== 'object') {
    return null;
  }

  setStoredUser(user);
  return user;
}

export async function updateMatchPreference(
  interestedIn: string,
): Promise<
  { ok: true; user: StoredUser } | { ok: false; code?: string; error: string }
> {
  const res = await fetch(apiUrl('/api/profile/preference'), {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ interestedIn }),
  });
  const data = (await res.json().catch(() => ({}))) as ApiUserResponse & {
    error?: string | { error?: string; code?: string };
    code?: string;
  };

  if (res.status === 403) {
    const nested =
      typeof data.error === 'object' && data.error ? data.error : null;
    return {
      ok: false,
      code: nested?.code ?? data.code ?? 'SUBSCRIPTION_REQUIRED',
      error:
        nested?.error ??
        (typeof data.error === 'string' ? data.error : null) ??
        data.message ??
        'Subscription required',
    };
  }

  if (!res.ok || !data.user) {
    return {
      ok: false,
      error:
        (typeof data.error === 'string' ? data.error : null) ??
        data.message ??
        'Failed to update preference',
    };
  }

  setStoredUser(data.user);
  return { ok: true, user: data.user };
}

export async function subscribeWithCard(input: {
  plan: string;
  nameOnCard: string;
  cardNumber: string;
  expiry: string;
}): Promise<{ ok: true; user: StoredUser } | { ok: false; error: string }> {
  const res = await fetch(apiUrl('/api/subscribe'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      plan: input.plan,
      nameOnCard: input.nameOnCard,
      cardNumber: input.cardNumber.replace(/\s/g, ''),
      expiry: input.expiry.trim(),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as ApiUserResponse;

  if (!res.ok || !data.user) {
    return {
      ok: false,
      error:
        (typeof data.error === 'string' ? data.error : null) ??
        data.message ??
        'Subscription failed',
    };
  }

  setStoredUser(data.user);
  return { ok: true, user: data.user };
}
