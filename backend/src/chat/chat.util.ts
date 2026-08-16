/** Canonical key for chats between the same two authenticated users. */
export function buildParticipantPairKey(
  userIdA?: string | null,
  userIdB?: string | null,
): string | null {
  const ids = [userIdA, userIdB].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (ids.length < 2) return null;
  return [...ids].sort().join(':');
}
