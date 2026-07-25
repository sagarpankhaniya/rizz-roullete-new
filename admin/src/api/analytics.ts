import api from "../lib/api";

export type DashboardSummary = {
  totalUsers: number;
  activeUsers: number;
  bannedUsers: number;
  subscribedUsers: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalCreators: number;
  invitedCreators: number;
  acceptedCreators: number;
  bannedCreators: number;
};

export type ChartPoint = {
  label: string;
  count: number;
};

export type DashboardAnalytics = {
  success: boolean;
  summary: DashboardSummary;
  charts: {
    userSignups: ChartPoint[];
    creatorInvites: ChartPoint[];
    usersByGender: ChartPoint[];
    usersByStatus: ChartPoint[];
    creatorsByStatus: ChartPoint[];
  };
};

export async function getDashboardAnalytics() {
  const { data } = await api.get<DashboardAnalytics>(
    "/admin/analytics/dashboard",
  );
  return data;
}
