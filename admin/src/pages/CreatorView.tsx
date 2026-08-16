import { Link, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import PageMeta from "../components/common/PageMeta";
import Badge from "../components/ui/badge/Badge";
import { getCreator } from "../api/creators";
import { getCreatorCoinEarnings } from "../api/coins";
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

export default function CreatorView() {
  const { id = "" } = useParams<{ id: string }>();

  const query = useQuery({
    queryKey: ["admin", "creators", id],
    queryFn: () => getCreator(id),
    enabled: Boolean(id),
  });

  const creator = query.data;
  const user = creator?.user;

  const earningsQuery = useQuery({
    queryKey: ["admin", "coins", "creator-earnings", user?.id],
    queryFn: () => getCreatorCoinEarnings(user!.id),
    enabled: Boolean(user?.id && user.isVip),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PageMeta
        title={
          creator
            ? `${creator.email} | Creators | Rizz Outlet Admin`
            : "Creator | Rizz Outlet Admin"
        }
        description="Creator details in Rizz Outlet admin"
      />

      <div className="mb-4 shrink-0">
        <Link
          to="/creators"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
        >
          <span aria-hidden="true">←</span>
          Back
        </Link>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Creator details
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Invite and account metadata
        </p>
      </div>

      {query.isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Loading creator...
        </p>
      )}

      {query.isError && (
        <p className="text-error-500 text-sm">
          {getApiErrorMessage(query.error, "Failed to load creator")}
        </p>
      )}

      {creator && (
        <div className="space-y-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03] md:p-6">
            <div className="mb-6 flex flex-wrap items-start gap-4 border-b border-gray-100 pb-6 dark:border-white/[0.05]">
              {user?.photo ? (
                <img
                  src={user.photo}
                  alt={user.firstName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-lg font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {(user?.firstName || creator.email).slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {user?.firstName || creator.email}
                </h3>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {creator.email}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge
                    size="sm"
                    color={
                      creator.status === "accepted" ? "success" : "warning"
                    }
                  >
                    {creator.status}
                  </Badge>
                  {user && (
                    <Badge
                      size="sm"
                      color={user.isBanned ? "error" : "success"}
                    >
                      {user.isBanned ? "Banned" : "Active"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <h4 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white/90">
              Invite
            </h4>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Invite ID" value={creator.id} />
              <DetailItem label="Email" value={creator.email} />
              <DetailItem label="Status" value={creator.status} />
              <DetailItem
                label="Invited at"
                value={formatDateTime(creator.invitedAt)}
              />
              <DetailItem
                label="Accepted at"
                value={formatDateTime(creator.acceptedAt)}
              />
              <DetailItem label="User ID" value={display(creator.userId)} />
              <DetailItem
                label="Invite URL"
                value={
                  <a
                    href={creator.inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-500 break-all hover:underline"
                  >
                    {creator.inviteUrl}
                  </a>
                }
                className="sm:col-span-2 lg:col-span-3"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03] md:p-6">
            <h4 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white/90">
              Account
            </h4>
            {user ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="User ID" value={user.id} />
                <DetailItem label="Name" value={user.firstName} />
                <DetailItem label="Email" value={user.email} />
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
                  label="Subscribed"
                  value={user.isSubscribed ? "Yes" : "No"}
                />
                <DetailItem
                  label="Subscription plan"
                  value={display(user.subscriptionPlan)}
                />
                <DetailItem label="VIP" value={user.isVip ? "Yes" : "No"} />
                <DetailItem
                  label="Creator earnings"
                  value={(user.creatorEarnings ?? 0).toLocaleString()}
                />
                <DetailItem
                  label="Wallet coins"
                  value={(user.walletCoins ?? 0).toLocaleString()}
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
                  label="Account status"
                  value={user.isBanned ? "Banned" : "Active"}
                />
                <DetailItem
                  label="Ban reason"
                  value={display(user.banReason)}
                />
                <DetailItem
                  label="Banned at"
                  value={formatDateTime(user.bannedAt)}
                />
                <DetailItem
                  label="Joined"
                  value={formatDateTime(user.createdAt)}
                />
                <DetailItem
                  label="Photo URL"
                  value={display(user.photo)}
                  className="sm:col-span-2 lg:col-span-3"
                />
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No account yet — invite has not been accepted.
              </p>
            )}
          </div>

          {user?.isVip && earningsQuery.data && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/[0.05] dark:bg-white/[0.03] md:p-6">
              <h4 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white/90">
                Coin earnings (payout basis)
              </h4>
              <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Lifetime total
                  </p>
                  <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                    {earningsQuery.data.totalEarnings.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    From tips
                  </p>
                  <p className="text-xl font-semibold text-success-600 dark:text-success-400">
                    {earningsQuery.data.tipsTotal.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    From room entry
                  </p>
                  <p className="text-xl font-semibold text-warning-600 dark:text-warning-400">
                    {earningsQuery.data.entryTotal.toLocaleString()}
                  </p>
                </div>
              </div>
              {earningsQuery.data.recent.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Recent transactions
                  </p>
                  <ul className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {earningsQuery.data.recent.map((tx) => (
                      <li
                        key={tx.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                      >
                        <span>
                          <Badge size="sm" color="light">
                            {tx.type === "entry_fee" ? "Entry" : "Tip"}
                          </Badge>{" "}
                          {tx.user?.firstName || "Fan"} ·{" "}
                          {formatDateTime(tx.createdAt)}
                        </span>
                        <span className="font-medium text-success-600 dark:text-success-400">
                          +{tx.creatorAmount.toLocaleString()} coins
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                <Link to="/coins" className="text-brand-500 hover:underline">
                  View purchases &amp; tips ledger →
                </Link>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
