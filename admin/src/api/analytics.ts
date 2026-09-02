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
  visitorsToday: number;
  visitorsThisWeek: number;
};

export type ChartPoint = {
  label: string;
  count: number;
};

export type VisitorDayPoint = {
  label: string;
  visitors: number;
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
    dailyVisitors: VisitorDayPoint[];
  };
};

export type VisitorAnalytics = {
  success: boolean;
  from: string;
  to: string;
  totalUniqueVisitors: number;
  series: VisitorDayPoint[];
};

export async function getDashboardAnalytics() {
  const { data } = await api.get<DashboardAnalytics>(
    "/admin/analytics/dashboard",
  );
  return data;
}

export async function getVisitorAnalytics(params: {
  from: string;
  to: string;
}) {
  const { data } = await api.get<VisitorAnalytics>(
    "/admin/analytics/visitors",
    { params },
  );
  return data;
}
