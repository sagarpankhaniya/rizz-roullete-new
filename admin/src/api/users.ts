import api from "../lib/api";

export type AdminUser = {
  id: string;
  firstName: string;
  email: string;
  role: string;
  gender: string | null;
  interestedIn: string | null;
  country: string | null;
  matchCountry: string | null;
  photo: string | null;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  subscribedAt: string | null;
  isVip: boolean;
  creatorInviteId: string | null;
  registrationIp: string | null;
  userAgent: string | null;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PaginatedResponse<T> = {
  success: boolean;
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListUsersParams = {
  page?: number;
  limit?: number;
  search?: string;
  isBanned?: boolean;
  isSubscribed?: boolean;
  gender?: "male" | "female";
};

export async function listUsers(params: ListUsersParams = {}) {
  const { data } = await api.get<PaginatedResponse<AdminUser>>(
    "/admin/users",
    { params },
  );
  return data;
}

export async function getUser(id: string) {
  const { data } = await api.get<{ success: boolean; user: AdminUser }>(
    `/admin/users/${id}`,
  );
  return data.user;
}

export async function banUser(id: string, reason?: string) {
  const { data } = await api.post<{ success: boolean; user: AdminUser }>(
    `/admin/users/${id}/ban`,
    reason ? { reason } : {},
  );
  return data;
}

export async function unbanUser(id: string) {
  const { data } = await api.post<{ success: boolean; user: AdminUser }>(
    `/admin/users/${id}/unban`,
  );
  return data;
}
