import type { Creator } from './creators.types';

/**
 * Fallback browse catalog when no VIP creators exist in Mongo yet.
 * Lets users discover creators for free; pay-to-enter applies only on room join.
 */
export const SHOWCASE_CREATORS: Creator[] = [
  { id: 'lily', slug: 'lily', name: 'Lily', bio: 'Spin in. Stay a while.', country: 'USA', isOnline: true },
  { id: 'lusia', slug: 'lusia', name: 'Lusia', bio: 'Verified creator · live after dark.', country: 'Brazil', isOnline: true },
  { id: 'bella', slug: 'bella', name: 'Bella', bio: 'Your new addiction starts here.', country: 'Colombia', isOnline: true },
  { id: 'pamela-nicoli', slug: 'pamela-nicoli', name: 'Pamela Nicoli', bio: 'Featured creator on the deck.', country: 'Argentina', isOnline: true },
  { id: 'valarie-spice', slug: 'valarie-spice', name: 'Valarie Spice', bio: 'Tips go straight to her.', country: 'USA', isOnline: true },
  { id: 'valentina', slug: 'valentina', name: 'Valentina', bio: 'Spin the wheel. Find your rizz.', country: 'Mexico', isOnline: true },
  { id: 'hana-sophia', slug: 'hana-sophia', name: 'Hana Sophia', bio: 'Verified 18+ creator.', country: 'Japan', isOnline: false },
  { id: 'eliesha', slug: 'eliesha', name: 'Eliesha', bio: 'Live creator room.', country: 'UK', isOnline: true },
  { id: 'elma-redhoneylux', slug: 'elma-redhoneylux', name: 'Elma Redhoneylux', bio: 'Premium creator experience.', country: 'Spain', isOnline: true },
  { id: 'kaylov', slug: 'kaylov', name: 'Kaylov', bio: 'Flip a card. Meet her.', country: 'Canada', isOnline: true },
  { id: 'alejandra', slug: 'alejandra', name: 'Alejandra', bio: 'Creator deck featured.', country: 'Chile', isOnline: true },
  { id: 'bong-vixen', slug: 'bong-vixen', name: 'Bong Vixen', bio: 'Unmoderated creator room.', country: 'Thailand', isOnline: true },
  { id: 'divina', slug: 'divina', name: 'Divina', bio: 'Spin into her room.', country: 'Italy', isOnline: false },
  { id: 'juliana', slug: 'juliana', name: 'Juliana', bio: 'Verified creator profile.', country: 'Portugal', isOnline: true },
  { id: 'araujo', slug: 'araujo', name: 'Araujo', bio: 'Live on Rizz Roulette.', country: 'Brazil', isOnline: true },
  { id: 'lana', slug: 'lana', name: 'Lana', bio: 'Hold to tip once you are in.', country: 'USA', isOnline: true },
  { id: 'andressa-sirigalli', slug: 'andressa-sirigalli', name: 'Andressa Sirigalli', bio: 'Creator from the deck.', country: 'Brazil', isOnline: true },
  { id: 'natalia', slug: 'natalia', name: 'Natalia', bio: 'Featured on the roulette deck.', country: 'Ukraine', isOnline: true },
  { id: 'vaen', slug: 'vaen', name: 'Vaen', bio: 'Spin in when she is live.', country: 'France', isOnline: false },
];

export function findShowcaseCreator(idOrSlug: string): Creator | null {
  const key = idOrSlug.toLowerCase().trim();
  return (
    SHOWCASE_CREATORS.find(
      (c) => c.id === key || c.slug === key,
    ) ?? null
  );
}
