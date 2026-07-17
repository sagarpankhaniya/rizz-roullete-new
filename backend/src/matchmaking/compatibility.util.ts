import {
  normalizeGender,
  normalizeInterestedIn,
} from '../common/utils/normalize.util';

export type MatchGender = 'male' | 'female';
export type MatchInterest =
  | 'male'
  | 'female'
  | 'everyone'
  | 'couple'
  | 'other';

export interface MatchPrefs {
  gender: MatchGender;
  /** Normalized preference used for queue buckets (`couple`/`other` → `everyone`). */
  interestedIn: 'male' | 'female' | 'everyone';
}

/**
 * Map registration preference onto queue buckets.
 * `couple` / `other` behave like `everyone` (no gender restriction).
 */
export function toQueueInterest(
  interestedIn: MatchInterest,
): MatchPrefs['interestedIn'] {
  if (interestedIn === 'male' || interestedIn === 'female') {
    return interestedIn;
  }
  return 'everyone';
}

export function parseMatchPrefs(
  gender: unknown,
  interestedIn: unknown,
): MatchPrefs | null {
  const g = normalizeGender(gender);
  const raw = normalizeInterestedIn(interestedIn);
  if (!g || !raw) return null;
  return { gender: g, interestedIn: toQueueInterest(raw) };
}

export function userWantsGender(
  interestedIn: MatchPrefs['interestedIn'],
  partnerGender: MatchGender,
): boolean {
  if (interestedIn === 'everyone') return true;
  return interestedIn === partnerGender;
}

/** Mutual gender preference check (registration interestedIn ↔ partner gender). */
export function usersAreCompatible(a: MatchPrefs, b: MatchPrefs): boolean {
  return (
    userWantsGender(a.interestedIn, b.gender) &&
    userWantsGender(b.interestedIn, a.gender)
  );
}

/**
 * Redis queue buckets that may hold a compatible partner for `me`.
 * Partner gender must match what I want; partner must want my gender (or everyone).
 */
export function candidateBuckets(me: MatchPrefs): string[] {
  const targetGenders: MatchGender[] =
    me.interestedIn === 'everyone' ? ['male', 'female'] : [me.interestedIn];

  const buckets: string[] = [];
  for (const gender of targetGenders) {
    // Prefer people specifically looking for my gender, then open preference.
    buckets.push(`${gender}:${me.gender}`);
    buckets.push(`${gender}:everyone`);
  }
  return buckets;
}

export function ownBucket(me: MatchPrefs): string {
  return `${me.gender}:${me.interestedIn}`;
}
