import { apiUrl } from '../utils/api';
import { SHOWCASE_CREATORS } from '../data/showcase-creators';

export type Creator = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  photo?: string | null;
  gender?: string | null;
  country?: string | null;
  isOnline: boolean;
  isShowcase?: boolean;
};

export async function fetchCreators(): Promise<Creator[]> {
  try {
    const res = await fetch(apiUrl('/api/creators'));
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.items)) {
      throw new Error('Invalid response');
    }
    if (data.items.length > 0) {
      return data.items as Creator[];
    }
    return SHOWCASE_CREATORS;
  } catch {
    // Browse is free — never show an empty deck because the server hiccuped.
    return SHOWCASE_CREATORS;
  }
}

export async function fetchCreatorById(id: string): Promise<Creator | null> {
  try {
    const res = await fetch(apiUrl(`/api/creators/${encodeURIComponent(id)}`));
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.creator) {
        return data.creator as Creator;
      }
    }
  } catch {
    // fall through to local showcase catalog
  }

  return (
    SHOWCASE_CREATORS.find(
      (c) => c.id === id || c.slug === id,
    ) ?? null
  );
}

/** Save intent before signup — does NOT grant room access. */
export function storePendingCreator(creator: Pick<Creator, 'id' | 'name'>) {
  localStorage.setItem('rizz_pending_creator_id', creator.id);
  localStorage.setItem('rizz_pending_creator_name', creator.name);
}

export function getPendingCreatorId() {
  return localStorage.getItem('rizz_pending_creator_id');
}

export function clearPendingCreator() {
  localStorage.removeItem('rizz_pending_creator_id');
  localStorage.removeItem('rizz_pending_creator_name');
}

/** After entry fee is paid — enables creator room call mode. */
export function storeCreatorRoom(creator: Pick<Creator, 'id' | 'name'>) {
  localStorage.setItem('rizz_creator_id', creator.id);
  localStorage.setItem('rizz_creator_room', creator.name);
  localStorage.setItem('rizz_creator_entry_paid', creator.id);
  localStorage.setItem('rizz_enter_call', '1');
  clearPendingCreator();
}

export function getCreatorId() {
  return localStorage.getItem('rizz_creator_id');
}

export function hasCreatorEntryPaid() {
  const creatorId = localStorage.getItem('rizz_creator_id');
  const paidFor = localStorage.getItem('rizz_creator_entry_paid');
  return Boolean(creatorId && paidFor === creatorId);
}

export function clearCreatorRoomEntry() {
  localStorage.removeItem('rizz_enter_call');
}

export function clearCreatorSession() {
  localStorage.removeItem('rizz_creator_id');
  localStorage.removeItem('rizz_creator_room');
  localStorage.removeItem('rizz_creator_entry_paid');
  localStorage.removeItem('rizz_enter_call');
  clearPendingCreator();
}

export function hasPendingCreatorCall() {
  return (
    localStorage.getItem('rizz_enter_call') === '1' && hasCreatorEntryPaid()
  );
}

export function hasPendingCreatorSignup() {
  return Boolean(getPendingCreatorId());
}
