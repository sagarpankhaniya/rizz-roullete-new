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
  banCreator,
  inviteCreator,
  listCreators,
  unbanCreator,
  type AdminCreator,
  type ListCreatorsParams,
} from "../api/creators";
import { getApiErrorMessage } from "../api/auth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatDate } from "../lib/format";

const LIMIT = 10;

const actionLinkClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ring-gray-300 transition hover:bg-gray-50 dark:ring-gray-700 dark:hover:bg-white/[0.03]";

type ConfirmAction = {
  type: "ban" | "unban";
  creator: AdminCreator;
};

export default function Creators() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ListCreatorsParams["status"] | "">("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingCreatorId, setPendingCreatorId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [banReason, setBanReason] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const query = useQuery({
    queryKey: [
      "admin",
      "creators",
      { page, search: debouncedSearch, status },
    ],
    queryFn: () =>
      listCreators({
        page,
        limit: LIMIT,
        search: debouncedSearch.trim() || undefined,
        status: status || undefined,
      }),
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) => inviteCreator(email),
    onSuccess: (_data, email) => {
      toast.success(`Invite sent to ${email}`);
      closeInviteModal();
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["admin", "creators"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to send invite"));
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      banCreator(id, reason),
    onMutate: ({ id }) => {
      setPendingCreatorId(id);
    },
    onSuccess: () => {
      toast.success("Creator banned successfully");
      closeConfirmModal();
      queryClient.invalidateQueries({ queryKey: ["admin", "creators"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to ban creator"));
    },
    onSettled: () => setPendingCreatorId(null),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => unbanCreator(id),
    onMutate: (id) => {
      setPendingCreatorId(id);
    },
    onSuccess: () => {
      toast.success("Creator unbanned successfully");
      closeConfirmModal();
      queryClient.invalidateQueries({ queryKey: ["admin", "creators"] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to unban creator"));
    },
    onSettled: () => setPendingCreatorId(null),
  });

  function openInviteModal() {
    setInviteEmail("");
    setInviteOpen(true);
  }

  function closeInviteModal() {
    setInviteOpen(false);
    setInviteEmail("");
  }

  function submitInvite() {
    const email = inviteEmail.trim();
    if (!email || inviteMutation.isPending) {
      if (!email) toast.error("Email is required");
      return;
    }
    inviteMutation.mutate(email);
  }

  function openBanModal(creator: AdminCreator) {
    setBanReason("");
    setConfirmAction({ type: "ban", creator });
  }

  function openUnbanModal(creator: AdminCreator) {
    setBanReason("");
    setConfirmAction({ type: "unban", creator });
  }

  function closeConfirmModal() {
    setConfirmAction(null);
    setBanReason("");
  }

  const isActionPending = banMutation.isPending || unbanMutation.isPending;
  const isBan = confirmAction?.type === "ban";

  function confirmModalAction() {
    if (!confirmAction || isActionPending) return;

    if (confirmAction.type === "ban") {
      banMutation.mutate({
        id: confirmAction.creator.id,
        reason: banReason.trim() || undefined,
      });
      return;
    }

    unbanMutation.mutate(confirmAction.creator.id);
  }

  const data = query.data;
  const items = data?.items ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageMeta
        title="Creators | Rizz Outlet Admin"
        description="Manage creators in Rizz Outlet admin"
      />

      <div className="mb-4 flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Creators
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Creator invites and accepted accounts
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
          <div className="w-full sm:w-56">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ListCreatorsParams["status"] | "");
                setPage(1);
              }}
              className="shadow-theme-xs focus:border-brand-300 focus:ring-brand-500/20 dark:focus:border-brand-800 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 focus:ring-3 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">All statuses</option>
              <option value="invited">Invited</option>
              <option value="accepted">Accepted</option>
            </select>
          </div>
          <div className="w-full sm:w-64">
            <Input
              type="search"
              placeholder="Search email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={openInviteModal}
            className="!px-4 !py-2.5 whitespace-nowrap"
          >
            Invite creator
          </Button>
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
                  Email
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
                  Account
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Account status
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Invited
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs bg-white px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                >
                  Accepted
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
                    Loading creators...
                  </TableCell>
                </TableRow>
              )}

              {query.isError && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-theme-sm text-error-500 px-5 py-8 text-center"
                  >
                    {getApiErrorMessage(query.error, "Failed to load creators")}
                  </TableCell>
                </TableRow>
              )}

              {!query.isLoading && !query.isError && items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-theme-sm px-5 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    No creators found.
                  </TableCell>
                </TableRow>
              )}

              {items.map((creator) => {
                const isRowPending =
                  pendingCreatorId === creator.id && isActionPending;
                const account = creator.user;

                return (
                  <TableRow key={creator.id}>
                    <TableCell className="text-theme-sm px-5 py-4 text-start font-medium text-gray-800 sm:px-6 dark:text-white/90">
                      {creator.email}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-start">
                      <Badge
                        size="sm"
                        color={
                          creator.status === "accepted" ? "success" : "warning"
                        }
                      >
                        {creator.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-theme-sm px-4 py-3 text-start font-medium text-gray-800 dark:text-white/90">
                      {account?.firstName || "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-start">
                      {account ? (
                        <Badge
                          size="sm"
                          color={account.isBanned ? "error" : "success"}
                        >
                          {account.isBanned ? "Banned" : "Active"}
                        </Badge>
                      ) : (
                        <span className="text-theme-sm text-gray-500 dark:text-gray-400">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-theme-sm px-4 py-3 text-start text-gray-500 dark:text-gray-400">
                      {formatDate(creator.invitedAt)}
                    </TableCell>
                    <TableCell className="text-theme-sm px-4 py-3 text-start text-gray-500 dark:text-gray-400">
                      {formatDate(creator.acceptedAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-start">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/creators/${creator.id}`}
                          title="View creator"
                          aria-label={`View ${creator.email}`}
                          className={actionLinkClass}
                        >
                          <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                        </Link>
                        {account &&
                          (account.isBanned ? (
                            <IconActionButton
                              label={
                                isRowPending
                                  ? "Unbanning..."
                                  : "Unban creator"
                              }
                              disabled={isRowPending}
                              onClick={() => openUnbanModal(creator)}
                            >
                              <UnbanIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                            </IconActionButton>
                          ) : (
                            <IconActionButton
                              label={
                                isRowPending ? "Banning..." : "Ban creator"
                              }
                              tone="danger"
                              disabled={isRowPending}
                              onClick={() => openBanModal(creator)}
                            >
                              <BanIcon className="size-5 fill-current" />
                            </IconActionButton>
                          ))}
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

      <Modal
        isOpen={inviteOpen}
        onClose={() => {
          if (!inviteMutation.isPending) closeInviteModal();
        }}
      >
        <div>
          <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            Invite creator
          </h3>
          <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
            Send a one-time signup invite email to a creator.
          </p>

          <div className="mb-5">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="creator@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviteMutation.isPending}
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={closeInviteModal}
              disabled={inviteMutation.isPending}
              className="!px-4 !py-2.5"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={submitInvite}
              disabled={inviteMutation.isPending}
              className="!px-4 !py-2.5"
            >
              {inviteMutation.isPending ? "Sending..." : "Send invite"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(confirmAction)}
        onClose={() => {
          if (!isActionPending) closeConfirmModal();
        }}
      >
        {confirmAction && (
          <div>
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
              {isBan ? "Ban creator" : "Unban creator"}
            </h3>
            <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
              {isBan
                ? "Are you sure you want to ban"
                : "Are you sure you want to unban"}{" "}
              <span className="font-medium text-gray-800 dark:text-white/90">
                {confirmAction.creator.user?.firstName ||
                  confirmAction.creator.email}
              </span>{" "}
              ({confirmAction.creator.email})?
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
                onClick={closeConfirmModal}
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
                    ? "Ban creator"
                    : "Unban creator"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
