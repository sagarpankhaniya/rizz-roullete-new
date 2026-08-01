import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import PageMeta from "../components/common/PageMeta";
import Pagination from "../components/common/Pagination";
import Input from "../components/form/input/InputField";
import Label from "../components/form/Label";
import Badge from "../components/ui/badge/Badge";
import Button from "../components/ui/button/Button";
import IconActionButton from "../components/ui/button/IconActionButton";
import Modal from "../components/ui/modal/Modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { BanIcon, EyeIcon, UnbanIcon } from "../icons";
import {
  banFromReport,
  dismissReport,
  listReports,
  type AdminReport,
  type ReportStatus,
} from "../api/reports";
import { getApiErrorMessage } from "../api/auth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatDateTime } from "../lib/format";

const actionLinkClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:ring-gray-700 dark:hover:bg-white/[0.03]";

const LIMIT = 10;

type ConfirmAction = {
  type: "ban" | "dismiss";
  report: AdminReport;
};

const STATUS_FILTERS: Array<{ value: "" | ReportStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "dismissed", label: "Dismissed" },
  { value: "banned", label: "Banned" },
];

function statusBadgeColor(status: ReportStatus) {
  if (status === "pending") return "warning";
  if (status === "banned") return "error";
  if (status === "dismissed") return "light";
  return "success";
}

export default function Reports() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | ReportStatus>("pending");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [notes, setNotes] = useState("");
  const [banReason, setBanReason] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: [
      "admin",
      "reports",
      { page, search: debouncedSearch, status },
    ],
    queryFn: () =>
      listReports({
        page,
        limit: LIMIT,
        search: debouncedSearch.trim() || undefined,
        status: status || undefined,
      }),
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      dismissReport(id, notes),
    onMutate: ({ id }) => setPendingId(id),
    onSuccess: () => {
      toast.success("Report dismissed");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to dismiss report"));
    },
    onSettled: () => setPendingId(null),
  });

  const banMutation = useMutation({
    mutationFn: ({
      id,
      notes,
      banReason,
    }: {
      id: string;
      notes?: string;
      banReason?: string;
    }) => banFromReport(id, { notes, banReason }),
    onMutate: ({ id }) => setPendingId(id),
    onSuccess: () => {
      toast.success("User banned from report");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "creators"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to ban user"));
    },
    onSettled: () => setPendingId(null),
  });

  function openDismiss(report: AdminReport) {
    setNotes("");
    setBanReason("");
    setConfirmAction({ type: "dismiss", report });
  }

  function openBan(report: AdminReport) {
    setNotes("");
    setBanReason(`Banned after user report (${report.reasonLabel})`);
    setConfirmAction({ type: "ban", report });
  }

  function closeModal() {
    setConfirmAction(null);
    setNotes("");
    setBanReason("");
  }

  const isActionPending = dismissMutation.isPending || banMutation.isPending;

  function confirmModalAction() {
    if (!confirmAction || isActionPending) return;
    if (confirmAction.type === "dismiss") {
      dismissMutation.mutate({
        id: confirmAction.report.id,
        notes: notes.trim() || undefined,
      });
      return;
    }
    banMutation.mutate({
      id: confirmAction.report.id,
      notes: notes.trim() || undefined,
      banReason: banReason.trim() || undefined,
    });
  }

  const data = query.data;
  const items = data?.items ?? [];
  const isBan = confirmAction?.type === "ban";
  const reported = confirmAction?.report.reportedUser;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageMeta
        title="Reports | Rizz Outlet Admin"
        description="Review user misconduct reports"
      />

      <div className="mb-4 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Reports
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            User misconduct reports from live calls
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row">
          <select
            className="h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as "" | ReportStatus);
              setPage(1);
            }}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            type="search"
            placeholder="Search name or details..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 border-b border-gray-100 bg-white dark:border-white/[0.05] dark:bg-gray-900">
              <TableRow>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Reported
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Reporter
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Reason
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Submitted
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-5 py-8 text-sm text-gray-500"
                  >
                    Loading reports...
                  </TableCell>
                </TableRow>
              )}
              {query.isError && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-error-500 px-5 py-8 text-sm"
                  >
                    {getApiErrorMessage(query.error, "Failed to load reports")}
                  </TableCell>
                </TableRow>
              )}
              {!query.isLoading && !query.isError && items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="px-5 py-8 text-sm text-gray-500"
                  >
                    No reports found.
                  </TableCell>
                </TableRow>
              )}
              {items.map((report) => {
                const reportedUser = report.reportedUser;
                const reporter = report.reporter;
                const busy = pendingId === report.id;
                return (
                  <TableRow key={report.id}>
                    <TableCell className="px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 dark:text-white/90">
                          {reportedUser?.firstName ||
                            report.reportedIdentity ||
                            "Unknown"}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          {reportedUser?.email || report.reportedUserId}
                        </p>
                        {reportedUser?.isVip && (
                          <Badge size="sm" color="warning">
                            VIP
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <p>
                        {reporter?.firstName ||
                          report.reporterIdentity ||
                          "Unknown"}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {reporter?.email || report.reporterId}
                      </p>
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <p className="text-sm text-gray-800 dark:text-white/90">
                        {report.reasonLabel}
                      </p>
                      {report.details && (
                        <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                          {report.details}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <Badge size="sm" color={statusBadgeColor(report.status)}>
                        {report.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-sm text-gray-500">
                      {formatDateTime(report.createdAt)}
                    </TableCell>
                    <TableCell className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {reportedUser && (
                          <Link
                            to={
                              reportedUser.isVip
                                ? "/creators"
                                : `/users/${reportedUser.id}`
                            }
                            title="View user"
                            aria-label={`View ${reportedUser.firstName}`}
                            className={actionLinkClass}
                          >
                            <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                          </Link>
                        )}
                        {report.status === "pending" && (
                          <>
                            <IconActionButton
                              label={busy ? "Dismissing..." : "Dismiss report"}
                              disabled={busy}
                              onClick={() => openDismiss(report)}
                            >
                              <UnbanIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                            </IconActionButton>
                            <IconActionButton
                              label={busy ? "Banning..." : "Ban user"}
                              tone="danger"
                              disabled={busy || Boolean(reportedUser?.isBanned)}
                              onClick={() => openBan(report)}
                            >
                              <BanIcon className="size-5 fill-current" />
                            </IconActionButton>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="mt-4 shrink-0">
        <Pagination
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 0}
          total={data?.total ?? 0}
          onPageChange={setPage}
          disabled={query.isFetching}
        />
      </div>

      <Modal isOpen={Boolean(confirmAction)} onClose={closeModal} className="max-w-lg">
        {confirmAction && (
          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              {isBan ? "Ban reported user" : "Dismiss report"}
            </h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              {isBan
                ? `Ban ${reported?.firstName || confirmAction.report.reportedIdentity || "this user"} for misconduct?`
                : "Mark this report as reviewed with no ban action."}
            </p>

            {isBan && (
              <div className="mb-4">
                <Label>Ban reason</Label>
                <Input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason shown to the banned user"
                />
              </div>
            )}

            <div className="mb-5">
              <Label>Admin notes (optional)</Label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal note"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={closeModal}
                disabled={isActionPending}
              >
                Cancel
              </Button>
              <Button onClick={confirmModalAction} disabled={isActionPending}>
                {isActionPending
                  ? "Saving…"
                  : isBan
                    ? "Ban user"
                    : "Dismiss report"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
