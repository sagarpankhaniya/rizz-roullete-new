import { UserDocument } from '../users/schemas/user.schema';

export function creatorSlug(firstName: string): string {
  return firstName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function mapCreator(user: UserDocument, isOnline = false) {
  const country = user.country?.trim() || null;
  return {
    id: String(user._id),
    slug: creatorSlug(user.firstName),
    name: user.firstName,
    bio: country ? `Creator from ${country}` : 'Verified Creator',
    photo: user.photo ?? null,
    gender: user.gender ?? null,
    country,
    isOnline,
  };
}
