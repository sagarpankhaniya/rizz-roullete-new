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
import { banUser, listUsers, unbanUser, type AdminUser } from "../api/users";
import { getApiErrorMessage } from "../api/auth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatDate } from "../lib/format";

const actionLinkClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:ring-gray-700 dark:hover:bg-white/[0.03]";

const LIMIT = 10;

type ConfirmAction = {
  type: "ban" | "unban";
  user: AdminUser;
};

export default function Users() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [banReason, setBanReason] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ["admin", "users", { page, search: debouncedSearch }],
    queryFn: () =>
      listUsers({
        page,
        limit: LIMIT,
        search: debouncedSearch.trim() || undefined,
      }),
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      banUser(id, reason),
    onMutate: ({ id }) => {
      setPendingUserId(id);
    },
    onSuccess: () => {
      toast.success("User banned successfully");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to ban user"));
    },
    onSettled: () => setPendingUserId(null),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => unbanUser(id),
    onMutate: (id) => {
      setPendingUserId(id);
    },
    onSuccess: () => {
      toast.success("User unbanned successfully");
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to unban user"));
    },
    onSettled: () => setPendingUserId(null),
  });

  function openBanModal(user: AdminUser) {
    setBanReason("");
    setConfirmAction({ type: "ban", user });
  }

  function openUnbanModal(user: AdminUser) {
    setBanReason("");
    setConfirmAction({ type: "unban", user });
  }

  function closeModal() {
    setConfirmAction(null);
    setBanReason("");
  }

  const isActionPending = banMutation.isPending || unbanMutation.isPending;

  function confirmModalAction() {
    if (!confirmAction || isActionPending) return;

    if (confirmAction.type === "ban") {
      banMutation.mutate({
        id: confirmAction.user.id,
        reason: banReason.trim() || undefined,
      });
      return;
    }

    unbanMutation.mutate(confirmAction.user.id);
  }

  const data = query.data;
  const items = data?.items ?? [];
  const isBan = confirmAction?.type === "ban";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageMeta
        title="Users | Rizz Outlet Admin"
        description="Manage users in Rizz Outlet admin"
      />

      <div className="mb-4 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Users
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Normal users (non-creators)
          </p>
        </div>
        <div className="w-full sm:max-w-xs">
          <Input
            type="search"
            placeholder="Search name or email..."
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
                  Name
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Email
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Gender
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Subscribed
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
                  Joined
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {query.isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-theme-sm px-5 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    Loading users...
                  </TableCell>
                </TableRow>
              )}

              {query.isError && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-theme-sm text-error-500 px-5 py-8 text-center"
                  >
                    {getApiErrorMessage(query.error, "Failed to load users")}
                  </TableCell>
                </TableRow>
              )}

              {!query.isLoading && !query.isError && items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-theme-sm px-5 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No users found.
                  </TableCell>
                </TableRow>
              )}

              {items.map((user) => {
                const isRowPending =
                  pendingUserId === user.id && isActionPending;

                return (
                  <TableRow key={user.id}>
                    <TableCell className="text-theme-sm px-5 py-4 text-start font-medium text-gray-800 sm:px-6 dark:text-white/90">
                      {user.firstName}
                    </TableCell>
                    <TableCell className="text-theme-sm px-4 py-3 text-start text-gray-500 dark:text-gray-400">
                      {user.email}
                    </TableCell>
                    <TableCell className="text-theme-sm px-4 py-3 text-start capitalize text-gray-500 dark:text-gray-400">
                      {user.gender || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-start">
                      <Badge
                        size="sm"
                        color={user.isSubscribed ? "success" : "light"}
                      >
                        {user.isSubscribed
                          ? user.subscriptionPlan || "Yes"
                          : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-start">
                      <Badge
                        size="sm"
                        color={user.isBanned ? "error" : "success"}
                      >
                        {user.isBanned ? "Banned" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-theme-sm px-4 py-3 text-start text-gray-500 dark:text-gray-400">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-start">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/users/${user.id}`}
                          title="View user"
                          aria-label={`View ${user.firstName}`}
                          className={actionLinkClass}
                        >
                          <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                        </Link>
                        {user.isBanned ? (
                          <IconActionButton
                            label={isRowPending ? "Unbanning..." : "Unban user"}
                            disabled={isRowPending}
                            onClick={() => openUnbanModal(user)}
                          >
                            <UnbanIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                          </IconActionButton>
                        ) : (
                          <IconActionButton
                            label={isRowPending ? "Banning..." : "Ban user"}
                            tone="danger"
                            disabled={isRowPending}
                            onClick={() => openBanModal(user)}
                          >
                            <BanIcon className="size-5 fill-current" />
                          </IconActionButton>
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

      <Modal isOpen={Boolean(confirmAction)} onClose={closeModal}>
        {confirmAction && (
          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              {isBan ? "Ban user" : "Unban user"}
            </h3>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
              {isBan ? "Are you sure you want to ban" : "Are you sure you want to unban"}{" "}
              <span className="font-medium text-gray-800 dark:text-white/90">
                {confirmAction.user.firstName}
              </span>{" "}
              ({confirmAction.user.email})?
            </p>

            {isBan && (
              <div className="mb-5">
                <Label>Ban reason (optional)</Label>
                <Input
                  type="text"
                  placeholder="Enter reason..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={closeModal}
                disabled={isActionPending}
                className="!px-4 !py-2.5"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={confirmModalAction}
                disabled={isActionPending}
                className={`!px-4 !py-2.5 ${
                  isBan ? "!bg-error-500 hover:!bg-error-600" : ""
                }`}
              >
                {isActionPending
                  ? isBan
                    ? "Banning..."
                    : "Unbanning..."
                  : isBan
                    ? "Ban user"
                    : "Unban user"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
