import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import PageMeta from "../components/common/PageMeta";
import Badge from "../components/ui/badge/Badge";
import { getUser } from "../api/users";
import { getApiErrorMessage } from "../api/auth";
import { formatDateTime } from "../lib/format";

function DetailItem({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <div className="text-sm break-words text-gray-800 dark:text-white/90">
        {value ?? "—"}
      </div>
    </div>
  );
}

function display(value?: string | null) {
  return value?.trim() ? value : "—";
}

export default function UserView() {
  const { id = "" } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["admin", "users", id],
    queryFn: () => getUser(id),
    enabled: Boolean(id),
  });

  const user = query.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PageMeta
        title={
          user
            ? `${user.firstName} | Users | Rizz Outlet Admin`
            : "User | Rizz Outlet Admin"
        }
        description="User details in Rizz Outlet admin"
      />

      <div className="mb-4 shrink-0">
        <Link
          to="/users"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
        >
          <span aria-hidden="true">←</span>
          Back
        </Link>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          User details
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Full profile and registration metadata
        </p>
      </div>

      {query.isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading user...
        </p>
      )}

      {query.isError && (
        <p className="text-error-500 text-sm">
          {getApiErrorMessage(query.error, "Failed to load user")}
        </p>
      )}

      {user && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03] md:p-6">
          <div className="mb-6 flex flex-wrap items-start gap-4 border-b border-gray-100 pb-6 dark:border-white/[0.05]">
            {user.photo ? (
              <img
                src={user.photo}
                alt={user.firstName}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-lg font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {user.firstName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {user.firstName}
              </h3>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge size="sm" color={user.isBanned ? "error" : "success"}>
                  {user.isBanned ? "Banned" : "Active"}
                </Badge>
                <Badge size="sm" color={user.isSubscribed ? "success" : "light"}>
                  {user.isSubscribed
                    ? user.subscriptionPlan || "Subscribed"
                    : "Not subscribed"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="User ID" value={user.id} />
            <DetailItem label="Name" value={user.firstName} />
            <DetailItem label="Email" value={user.email} />
            <DetailItem label="Role" value={user.role} />
            <DetailItem
              label="Gender"
              value={
                <span className="capitalize">{display(user.gender)}</span>
              }
            />
            <DetailItem
              label="Interested in"
              value={
                <span className="capitalize">
                  {display(user.interestedIn)}
                </span>
              }
            />
            <DetailItem label="Country" value={display(user.country)} />
            <DetailItem
              label="Match country"
              value={display(user.matchCountry)}
            />
            <DetailItem
              label="Subscribed"
              value={user.isSubscribed ? "Yes" : "No"}
            />
            <DetailItem
              label="Subscription plan"
              value={display(user.subscriptionPlan)}
            />
            <DetailItem
              label="Subscribed at"
              value={formatDateTime(user.subscribedAt)}
            />
            <DetailItem label="VIP / Creator" value={user.isVip ? "Yes" : "No"} />
            <DetailItem
              label="Creator invite ID"
              value={display(user.creatorInviteId)}
            />
            <DetailItem
              label="Registration IP"
              value={display(user.registrationIp)}
            />
            <DetailItem
              label="User agent"
              value={display(user.userAgent)}
              className="sm:col-span-2 lg:col-span-3"
            />
            <DetailItem
              label="Status"
              value={user.isBanned ? "Banned" : "Active"}
            />
            <DetailItem label="Ban reason" value={display(user.banReason)} />
            <DetailItem
              label="Banned at"
              value={formatDateTime(user.bannedAt)}
            />
            <DetailItem
              label="Joined"
              value={formatDateTime(user.createdAt)}
            />
            <DetailItem
              label="Updated"
              value={formatDateTime(user.updatedAt)}
            />
            <DetailItem
              label="Photo URL"
              value={display(user.photo)}
              className="sm:col-span-2 lg:col-span-3"
            />
          </div>
        </div>
      )}
    </div>
  );
}
