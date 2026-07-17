export interface PublicUser {
  id: string;
  firstName: string;
  email: string;
  gender: string | null;
  interestedIn: string | null;
  country: string | null;
  matchCountry: string | null;
  photo: string | null;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  nameOnCard: string | null;
  cardLast4: string | null;
  cardExpiry: string | null;
  subscribedAt: Date | null;
  isVip: boolean;
}

