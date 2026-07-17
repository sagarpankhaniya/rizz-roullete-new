export function normalizeGender(value: unknown): 'male' | 'female' | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  return v === 'male' || v === 'female' ? v : null;
}

export function normalizeInterestedIn(
  value: unknown,
): 'male' | 'female' | 'everyone' | 'couple' | 'other' | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === 'everyone' || v === 'all' || v === 'any') return 'everyone';
  if (v === 'male' || v === 'female' || v === 'couple' || v === 'other') {
    return v;
  }
  return null;
}

export function normalizeCountryCode(value: unknown): string | null {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) ? v : null;
}

