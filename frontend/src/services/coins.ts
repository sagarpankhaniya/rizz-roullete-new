import { getToken } from '../utils/auth';
import { apiUrl } from '../utils/api';

/** Must match backend CREATOR_ENTRY_FEE */
export const ENTRY_FEE = 500;

function parseApiError(body: Record<string, unknown>) {
  const raw = body.message;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const nested = raw as Record<string, unknown>;
    return {
      message:
        typeof nested.message === 'string'
          ? nested.message
          : 'Request failed',
      code: typeof nested.code === 'string' ? nested.code : undefined,
      required:
        typeof nested.required === 'number' ? nested.required : undefined,
      balance:
        typeof nested.balance === 'number' ? nested.balance : undefined,
    };
  }
  return {
    message: typeof raw === 'string' ? raw : 'Request failed',
    code: typeof body.code === 'string' ? body.code : undefined,
    required: undefined as number | undefined,
    balance: undefined as number | undefined,
  };
}

export async function getCoinBalance() {
  const token = getToken();
  if (!token) return { balance: 0 };

  const res = await fetch(apiUrl('/api/coins/balance'), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return { balance: 0 };
  return res.json();
}

export type CreatorEarnings = {
  lifetimeEarnings: number;
  totalEarnings: number;
  tipsTotal: number;
  entryTotal: number;
  transactionCount: number;
  recent: Array<{
    id: string;
    type: string;
    amount: number;
    creatorAmount: number;
    counterpartyName: string | null;
    createdAt: string | null;
    user: { firstName: string } | null;
  }>;
};

export async function getCreatorEarnings(): Promise<CreatorEarnings | null> {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(apiUrl('/api/coins/earnings'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function buyCoins(data: {
  packId: string;
  packLabel?: string;
  amount: number;
  nameOnCard: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}) {
  const token = getToken();
  if (!token) return { ok: false, error: 'Not authenticated' };

  const res = await fetch(apiUrl('/api/coins/buy'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const body = await res.json();
  if (!res.ok) return { ok: false, error: body.message || 'Purchase failed' };
  return { ok: true, balance: body.newBalance };
}

export async function enterCreatorRoom(creatorId: string) {
  const token = getToken();
  if (!token) {
    return { ok: false as const, error: 'Not authenticated', code: 'NOT_AUTH' };
  }

  const res = await fetch(apiUrl('/api/coins/enter-room'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ creatorId }),
  });

  const body = await res.json();
  if (!res.ok) {
    const err = parseApiError(body);
    return {
      ok: false as const,
      error: err.message,
      code: err.code,
      required: err.required,
      balance: err.balance,
    };
  }

  return {
    ok: true as const,
    newBalance: body.newBalance as number,
    entryFee: body.entryFee as number,
    creatorId: body.creatorId as string,
    creatorName: body.creatorName as string,
  };
}

export async function spendCoins(
  amount: number,
  creatorId?: string,
  reason?: string,
) {
  const token = getToken();
  if (!token) return { ok: false as const, error: 'Not authenticated' };

  const res = await fetch(apiUrl('/api/coins/spend'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount, creatorId, reason }),
  });

  const body = await res.json();
  if (!res.ok) {
    return {
      ok: false as const,
      error: body.message || 'Spend failed',
      code: body.code as string | undefined,
      balance: body.balance as number | undefined,
    };
  }

  return { ok: true as const, newBalance: body.newBalance as number };
}
