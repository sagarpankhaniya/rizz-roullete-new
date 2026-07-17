export const USER_KEY = 'rizz_user';

export type StoredUser = {
  id?: string;
  firstName?: string;
  gender?: string | null;
  interestedIn?: string | null;
  isSubscribed?: boolean;
  subscriptionPlan?: string | null;
  isVip?: boolean;
};

export function getStoredUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: unknown) {
  if (!user || typeof user !== 'object') return;
  const u = user as StoredUser;
  const prev = getStoredUser();
  const payload: StoredUser = {
    id: u.id ?? prev?.id,
    firstName: u.firstName ?? prev?.firstName,
    gender: u.gender ?? prev?.gender ?? null,
    interestedIn: u.interestedIn ?? prev?.interestedIn ?? null,
    isSubscribed:
      typeof u.isSubscribed === 'boolean'
        ? u.isSubscribed
        : (prev?.isSubscribed ?? false),
    subscriptionPlan:
      u.subscriptionPlan !== undefined
        ? u.subscriptionPlan
        : (prev?.subscriptionPlan ?? null),
    isVip:
      typeof u.isVip === 'boolean' ? u.isVip : (prev?.isVip ?? false),
  };
  localStorage.setItem(USER_KEY, JSON.stringify(payload));
}

export function clearStoredUser() {
  localStorage.removeItem(USER_KEY);
}

export function isUserSubscribed(): boolean {
  return Boolean(getStoredUser()?.isSubscribed);
}

export function isUserVip(): boolean {
  return Boolean(getStoredUser()?.isVip);
}
