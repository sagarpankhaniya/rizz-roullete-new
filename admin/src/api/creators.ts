import api from "../lib/api";
import type { PaginatedResponse } from "./users";

export type CreatorUser = {
  id: string;
  firstName: string;
  email: string;
  gender: string | null;
  interestedIn: string | null;
  country: string | null;
  photo: string | null;
  isSubscribed: boolean;
  subscriptionPlan: string | null;
  isVip: boolean;
  registrationIp: string | null;
  userAgent: string | null;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: string | null;
  createdAt: string | null;
};

export type AdminCreator = {
  id: string;
  email: string;
  status: "invited" | "accepted";
  inviteUrl: string;
  invitedAt: string | null;
  acceptedAt: string | null;
  userId: string | null;
  user: CreatorUser | null;
};

export type ListCreatorsParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "invited" | "accepted";
};

export async function listCreators(params: ListCreatorsParams = {}) {
  const { data } = await api.get<PaginatedResponse<AdminCreator>>(
    "/admin/creators",
    { params },
  );
  return data;
}

export async function getCreator(id: string) {
  const { data } = await api.get<{ success: boolean; creator: AdminCreator }>(
    `/admin/creators/${id}`,
  );
  return data.creator;
}

export type CreatorInviteResult = {
  inviteId: string;
  email: string;
  inviteUrl: string;
  status: "invited" | "accepted";
};

export async function inviteCreator(email: string) {
  const { data } = await api.post<{
    success: boolean;
    invite: CreatorInviteResult;
  }>("/admin/invites/creator", { email });
  return data.invite;
}

export async function banCreator(id: string, reason?: string) {
  const { data } = await api.post<{ success: boolean; creator: AdminCreator }>(
    `/admin/creators/${id}/ban`,
    reason ? { reason } : {},
  );
  return data;
}

export async function unbanCreator(id: string) {
  const { data } = await api.post<{ success: boolean; creator: AdminCreator }>(
    `/admin/creators/${id}/unban`,
  );
  return data;
}
