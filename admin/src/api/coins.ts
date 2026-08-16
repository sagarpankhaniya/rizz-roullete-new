import api from "../lib/api";

export type CoinTxType = "purchase" | "entry_fee" | "tip";

export type CoinTxUser = {
  id: string;
  firstName: string;
  email: string;
  isVip: boolean;
};

export type AdminCoinTransaction = {
  id: string;
  type: CoinTxType;
  userId: string;
  creatorId: string | null;
  amount: number;
  creatorAmount: number;
  platformAmount: number;
  balanceAfter: number | null;
  note: string | null;
  counterpartyName: string | null;
  createdAt: string | null;
  user: CoinTxUser | null;
  creator: CoinTxUser | null;
};

export type PaginatedCoinTransactions = {
  success: boolean;
  items: AdminCoinTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CoinTxCategory = "purchases" | "creator_earnings";

export type ListCoinTransactionsParams = {
  page?: number;
  limit?: number;
  type?: CoinTxType;
  category?: CoinTxCategory;
  creatorId?: string;
  userId?: string;
  search?: string;
};

export type PlatformCoinSummary = {
  success: boolean;
  byType: Array<{
    type: string;
    gross: number;
    platform: number;
    creator: number;
    count: number;
  }>;
};

export type CreatorEarningsDetail = {
  success: boolean;
  creator: {
    id: string;
    firstName: string;
    email: string;
    creatorEarnings: number;
    walletCoins: number;
  };
  totalEarnings: number;
  tipsTotal: number;
  entryTotal: number;
  transactionCount: number;
  recent: AdminCoinTransaction[];
};

export async function listCoinTransactions(
  params: ListCoinTransactionsParams = {},
) {
  const { data } = await api.get<PaginatedCoinTransactions>(
    "/admin/coins/transactions",
    { params },
  );
  return data;
}

export async function getPlatformCoinSummary() {
  const { data } = await api.get<PlatformCoinSummary>("/admin/coins/summary");
  return data;
}

export async function getCreatorCoinEarnings(userId: string) {
  const { data } = await api.get<CreatorEarningsDetail>(
    `/admin/coins/creators/${userId}/earnings`,
  );
  return data;
}
