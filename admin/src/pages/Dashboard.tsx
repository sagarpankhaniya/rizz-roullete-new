import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageMeta from "../components/common/PageMeta";
import { getDashboardAnalytics } from "../api/analytics";
import { getApiErrorMessage } from "../api/auth";

const GENDER_COLORS = ["#465fff", "#9cb9ff", "#98a2b3"];
const STATUS_COLORS = ["#12b76a", "#f04438"];
const CREATOR_COLORS = ["#f79009", "#12b76a"];

function formatShortDate(label: string) {
  const [, month, day] = label.split("-");
  return `${day}/${month}`;
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-800 dark:text-white/90">
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const query = useQuery({
    queryKey: ["admin", "analytics", "dashboard"],
    queryFn: getDashboardAnalytics,
  });

  const summary = query.data?.summary;
  const charts = query.data?.charts;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PageMeta
        title="Dashboard | Rizz Outlet Admin"
        description="Rizz Outlet admin analytics dashboard"
      />

      <div className="mb-6 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of users, creators, visitors, and recent activity
        </p>
      </div>

      {query.isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading analytics...
        </p>
      )}

      {query.isError && (
        <p className="text-error-500 text-sm">
          {getApiErrorMessage(query.error, "Failed to load dashboard")}
        </p>
      )}

      {summary && charts && (
        <div className="space-y-6 pb-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Visitors today"
              value={summary.visitorsToday}
            />
            <StatCard
              title="Visitors (7d)"
              value={summary.visitorsThisWeek}
            />
            <StatCard
              title="Total users"
              value={summary.totalUsers}
              hint={`${summary.activeUsers} active · ${summary.bannedUsers} banned`}
            />
            <StatCard
              title="Subscribed users"
              value={summary.subscribedUsers}
              hint={`${summary.newUsersThisWeek} new this week`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              title="Creators"
              value={summary.totalCreators}
              hint={`${summary.acceptedCreators} accepted · ${summary.invitedCreators} invited`}
            />
            <StatCard
              title="New users (30d)"
              value={summary.newUsersThisMonth}
              hint={`${summary.bannedCreators} banned creators`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCard
              title="Daily visitors"
              description="Unique visitors — last 14 days"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts.dailyVisitors}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 12, fill: "#98a2b3" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#98a2b3" }}
                  />
                  <Tooltip
                    labelFormatter={(value) => String(value)}
                    formatter={(value) => [Number(value ?? 0), "Visitors"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="visitors"
                    name="Unique visitors"
                    stroke="#465fff"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="User signups"
              description="Last 14 days"
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.userSignups}>
                  <defs>
                    <linearGradient id="userFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#465fff" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#465fff" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 12, fill: "#98a2b3" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#98a2b3" }}
                  />
                  <Tooltip
                    labelFormatter={(value) => String(value)}
                    formatter={(value) => [Number(value ?? 0), "Users"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#465fff"
                    fill="url(#userFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Creator invites"
              description="Last 14 days"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.creatorInvites}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    tickFormatter={formatShortDate}
                    tick={{ fontSize: 12, fill: "#98a2b3" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12, fill: "#98a2b3" }}
                  />
                  <Tooltip
                    labelFormatter={(value) => String(value)}
                    formatter={(value) => [Number(value ?? 0), "Invites"]}
                  />
                  <Bar dataKey="count" fill="#7592ff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard title="Users by gender">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.usersByGender}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {charts.usersByGender.map((entry, index) => (
                      <Cell
                        key={entry.label}
                        fill={GENDER_COLORS[index % GENDER_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      Number(value ?? 0),
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Users by status">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.usersByStatus}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {charts.usersByStatus.map((entry, index) => (
                      <Cell
                        key={entry.label}
                        fill={STATUS_COLORS[index % STATUS_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      Number(value ?? 0),
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Creators by status">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.creatorsByStatus}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {charts.creatorsByStatus.map((entry, index) => (
                      <Cell
                        key={entry.label}
                        fill={CREATOR_COLORS[index % CREATOR_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      Number(value ?? 0),
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}
