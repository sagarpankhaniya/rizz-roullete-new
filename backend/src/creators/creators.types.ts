export type Creator = {
  id: string;
  slug: string;
  name: string;
  bio: string;
  photo?: string | null;
  gender?: string | null;
  country?: string | null;
  isOnline: boolean;
  /** True when this row comes from the static showcase, not Mongo. */
  isShowcase?: boolean;
};
