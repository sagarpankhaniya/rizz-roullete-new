import api from "../lib/api";

export type ReportStatus = "pending" | "reviewed" | "dismissed" | "banned";

export type ReportUserSummary = {
  id: string;
  firstName: string;
  email: string;
  isVip: boolean;
  isBanned: boolean;
  banReason: string | null;
  photo: string | null;
};

export type AdminReport = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reporterIdentity: string | null;
  reportedIdentity: string | null;
  roomName: string | null;
  reason: string;
  reasonLabel: string;
  details: string | null;
  status: ReportStatus;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  reporter: ReportUserSummary | null;
  reportedUser: ReportUserSummary | null;
};

export type PaginatedReports = {
  success: boolean;
  items: AdminReport[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type ListReportsParams = {
  page?: number;
  limit?: number;
  status?: ReportStatus;
  search?: string;
};

export async function listReports(params: ListReportsParams = {}) {
  const { data } = await api.get<PaginatedReports>("/admin/reports", {
    params,
  });
  return data;
}

export async function getReport(id: string) {
  const { data } = await api.get<{ success: boolean; report: AdminReport }>(
    `/admin/reports/${id}`,
  );
  return data.report;
}

export async function dismissReport(id: string, notes?: string) {
  const { data } = await api.post<{ success: boolean; report: AdminReport }>(
    `/admin/reports/${id}/dismiss`,
    notes ? { notes } : {},
  );
  return data.report;
}

export async function banFromReport(
  id: string,
  options?: { notes?: string; banReason?: string },
) {
  const { data } = await api.post<{ success: boolean; report: AdminReport }>(
    `/admin/reports/${id}/ban`,
    options ?? {},
  );
  return data.report;
}
