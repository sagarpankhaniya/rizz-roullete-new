import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import PageMeta from "../components/common/PageMeta";
import Pagination from "../components/common/Pagination";
import Input from "../components/form/input/InputField";
import Badge from "../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  getPlatformCoinSummary,
  listCoinTransactions,
  type CoinTxCategory,
  type CoinTxType,
  type AdminCoinTransaction,
} from "../api/coins";
import { getApiErrorMessage } from "../api/auth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatDateTime } from "../lib/format";

const LIMIT = 12;

const thClass =
  "text-theme-xs bg-gray-50 px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400";
const tdClass = "px-5 py-4 align-top text-sm text-gray-700 dark:text-gray-300";

const PACK_LABELS: Record<string, string> = {
  small: "Small Boost",
  normal: "Normal Boost",
  super: "Super Boost",
  hyper: "Hyper Boost",
};

type TabId = CoinTxCategory;

function purchaseSource(tx: AdminCoinTransaction) {
  if (tx.note && !PACK_LABELS[tx.note]) return tx.note;
  if (tx.note && PACK_LABELS[tx.note]) return PACK_LABELS[tx.note];
  return "Coin pack";
}

function creatorSource(tx: AdminCoinTransaction) {
  if (tx.type === "entry_fee") return "Room entry fee";
  if (tx.note?.trim()) return tx.note.trim();
  return "Hold to tip / quick send";
}

function typeBadgeColor(type: CoinTxType) {
  if (type === "entry_fee") return "warning";
  return "success";
}

function formatCreatorType(type: CoinTxType) {
  return type === "entry_fee" ? "Room entry" : "Tip";
}

export default function CoinTransactions() {
  const [tab, setTab] = useState<TabId>("creator_earnings");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [creatorType, setCreatorType] = useState<"" | "tip" | "entry_fee">("");
  const debouncedSearch = useDebouncedValue(search);

  const txQuery = useQuery({
    queryKey: [
      "admin",
      "coins",
      "transactions",
      { tab, page, search: debouncedSearch, creatorType },
    ],
    queryFn: () =>
      listCoinTransactions({
        page,
        limit: LIMIT,
        category: tab,
        type:
          tab === "creator_earnings" && creatorType
            ? creatorType
            : undefined,
        search: debouncedSearch.trim() || undefined,
      }),
  });

  const summaryQuery = useQuery({
    queryKey: ["admin", "coins", "summary"],
    queryFn: getPlatformCoinSummary,
  });

  const summaryRows = summaryQuery.data?.byType ?? [];
  const purchaseRow = summaryRows.find((r) => r.type === "purchase");
  const tipRow = summaryRows.find((r) => r.type === "tip");
  const entryRow = summaryRows.find((r) => r.type === "entry_fee");
  const creatorGross = (tipRow?.gross ?? 0) + (entryRow?.gross ?? 0);
  const creatorShare = (tipRow?.creator ?? 0) + (entryRow?.creator ?? 0);
  const creatorPlatform = (tipRow?.platform ?? 0) + (entryRow?.platform ?? 0);
  const creatorTxCount = (tipRow?.count ?? 0) + (entryRow?.count ?? 0);

  const items = txQuery.data?.items ?? [];

  const switchTab = (next: TabId) => {
    setTab(next);
    setPage(1);
    setCreatorType("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PageMeta
        title="Purchases & Tips | Rizz Outlet Admin"
        description="Fan coin purchases and creator earnings from tips and room entry"
      />

      <div className="mb-6 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Purchases &amp; tips
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          <strong className="font-medium text-gray-700 dark:text-gray-300">
            Fan purchases
          </strong>{" "}
          top up a user&apos;s wallet (one buyer, many possible spends).{" "}
          <strong className="font-medium text-gray-700 dark:text-gray-300">
            Creator earnings
          </strong>{" "}
          are tips and room entry — a fan can send these to different creators
          over time.
        </p>
      </div>

      {summaryQuery.isSuccess && summaryRows.length > 0 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 dark:border-brand-500/20 dark:bg-brand-500/5">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Fan wallet purchases
            </p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {(purchaseRow?.gross ?? 0).toLocaleString()}{" "}
              <span className="text-base font-normal text-gray-500">coins sold</span>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>
                Platform revenue:{" "}
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {(purchaseRow?.platform ?? 0).toLocaleString()}
                </span>
              </li>
              <li>{purchaseRow?.count ?? 0} purchase(s) — goes to fan balance only</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-success-200 bg-success-50/40 p-5 dark:border-success-500/20 dark:bg-success-500/5">
            <p className="text-xs font-semibold uppercase tracking-wider text-success-700 dark:text-success-400">
              Creator earnings flow
            </p>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              {creatorGross.toLocaleString()}{" "}
              <span className="text-base font-normal text-gray-500">coins spent on creators</span>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>
                Creators earned:{" "}
                <span className="font-medium text-success-700 dark:text-success-400">
                  {creatorShare.toLocaleString()}
                </span>
                {" · "}
                Platform:{" "}
                <span className="font-medium">{creatorPlatform.toLocaleString()}</span>
              </li>
              <li>
                {entryRow?.count ?? 0} room entry · {tipRow?.count ?? 0} tip(s) ·{" "}
                {creatorTxCount} total
              </li>
            </ul>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => switchTab("creator_earnings")}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === "creator_earnings"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
          }`}
        >
          Creator earnings
          <span className="ml-2 text-xs font-normal opacity-70">tips &amp; room entry</span>
        </button>
        <button
          type="button"
          onClick={() => switchTab("purchases")}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            tab === "purchases"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
          }`}
        >
          Fan purchases
          <span className="ml-2 text-xs font-normal opacity-70">wallet top-ups</span>
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder={
              tab === "purchases"
                ? "Search fan name or email…"
                : "Search fan or creator name/email…"
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {tab === "creator_earnings" && (
          <select
            className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            value={creatorType}
            onChange={(e) => {
              setCreatorType(e.target.value as "" | "tip" | "entry_fee");
              setPage(1);
            }}
          >
            <option value="">All creator events</option>
            <option value="tip">Tips only</option>
            <option value="entry_fee">Room entry only</option>
          </select>
        )}
      </div>

      {txQuery.isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      )}

      {txQuery.isError && (
        <p className="text-error-500 text-sm">
          {getApiErrorMessage(txQuery.error, "Failed to load transactions")}
        </p>
      )}

      {txQuery.isSuccess && tab === "purchases" && (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableCell isHeader className={`${thClass} w-[18%]`}>
                    When
                  </TableCell>
                  <TableCell isHeader className={`${thClass} w-[22%]`}>
                    Fan
                  </TableCell>
                  <TableCell isHeader className={`${thClass} w-[28%]`}>
                    Pack / source
                  </TableCell>
                  <TableCell isHeader className={`${thClass} w-[16%] text-end`}>
                    Coins added
                  </TableCell>
                  <TableCell isHeader className={`${thClass} w-[16%] text-end`}>
                    Platform revenue
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className={`${tdClass} text-center text-gray-500`}>
                      No fan purchases yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02]">
                      <TableCell className={`${tdClass} whitespace-nowrap text-gray-500`}>
                        {formatDateTime(tx.createdAt)}
                      </TableCell>
                      <TableCell className={tdClass}>
                        {tx.user ? (
                          <div>
                            <Link
                              to={`/users/${tx.user.id}`}
                              className="font-medium text-brand-500 hover:underline"
                            >
                              {tx.user.firstName}
                            </Link>
                            <p className="truncate text-xs text-gray-500">{tx.user.email}</p>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className={tdClass}>
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {purchaseSource(tx)}
                        </p>
                        <p className="text-xs text-gray-500">Fan wallet top-up</p>
                      </TableCell>
                      <TableCell className={`${tdClass} text-end font-semibold text-gray-900 dark:text-white`}>
                        +{tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className={`${tdClass} text-end`}>
                        {tx.platformAmount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <Pagination
              page={txQuery.data.page}
              totalPages={txQuery.data.totalPages}
              total={txQuery.data.total}
              onPageChange={setPage}
              disabled={txQuery.isFetching}
            />
          </div>
        </>
      )}

      {txQuery.isSuccess && tab === "creator_earnings" && (
        <>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableCell isHeader className={thClass}>
                    When
                  </TableCell>
                  <TableCell isHeader className={thClass}>
                    Event
                  </TableCell>
                  <TableCell isHeader className={thClass}>
                    Fan → Creator
                  </TableCell>
                  <TableCell isHeader className={thClass}>
                    Menu / source
                  </TableCell>
                  <TableCell isHeader className={`${thClass} text-end`}>
                    Fan sent
                  </TableCell>
                  <TableCell isHeader className={`${thClass} text-end`}>
                    Creator gets
                  </TableCell>
                  <TableCell isHeader className={`${thClass} text-end`}>
                    Platform
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className={`${tdClass} text-center text-gray-500`}>
                      No tips or room entries yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((tx) => (
                    <TableRow key={tx.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02]">
                      <TableCell className={`${tdClass} whitespace-nowrap text-gray-500`}>
                        {formatDateTime(tx.createdAt)}
                      </TableCell>
                      <TableCell className={tdClass}>
                        <Badge size="sm" color={typeBadgeColor(tx.type)}>
                          {formatCreatorType(tx.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className={tdClass}>
                        <div className="flex flex-wrap items-center gap-1.5 text-sm">
                          {tx.user ? (
                            <Link
                              to={`/users/${tx.user.id}`}
                              className="font-medium text-brand-500 hover:underline"
                            >
                              {tx.user.firstName}
                            </Link>
                          ) : (
                            <span>Unknown fan</span>
                          )}
                          <span className="text-gray-400">→</span>
                          <span className="font-medium text-gray-800 dark:text-white/90">
                            {tx.creator?.firstName || tx.counterpartyName || "Creator"}
                          </span>
                        </div>
                        {tx.creator?.email && (
                          <p className="mt-0.5 truncate text-xs text-gray-500">
                            {tx.creator.email}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className={tdClass}>
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {creatorSource(tx)}
                        </p>
                        {tx.type === "tip" && !tx.note && (
                          <p className="text-xs text-gray-500">No menu label recorded</p>
                        )}
                      </TableCell>
                      <TableCell className={`${tdClass} text-end font-medium`}>
                        {tx.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className={`${tdClass} text-end font-semibold text-success-600 dark:text-success-400`}>
                        {tx.creatorAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className={`${tdClass} text-end text-gray-500`}>
                        {tx.platformAmount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <Pagination
              page={txQuery.data.page}
              totalPages={txQuery.data.totalPages}
              total={txQuery.data.total}
              onPageChange={setPage}
              disabled={txQuery.isFetching}
            />
          </div>
        </>
      )}
    </div>
  );
}
