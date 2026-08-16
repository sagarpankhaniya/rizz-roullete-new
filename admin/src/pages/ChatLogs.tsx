import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import PageMeta from "../components/common/PageMeta";
import Pagination from "../components/common/Pagination";
import Input from "../components/form/input/InputField";
import Label from "../components/form/Label";
import Badge from "../components/ui/badge/Badge";
import Button from "../components/ui/button/Button";
import Modal from "../components/ui/modal/Modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  listChatConversations,
  listChatMessages,
  type AdminChatConversation,
} from "../api/chat";
import { getApiErrorMessage } from "../api/auth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { formatDateTime } from "../lib/format";

const LIMIT = 12;
const MESSAGE_LIMIT = 100;

const thClass =
  "text-theme-xs bg-gray-50 px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400";
const tdClass = "px-5 py-4 align-top text-sm text-gray-700 dark:text-gray-300";

function formatEpoch(ms: number) {
  return formatDateTime(new Date(ms).toISOString());
}

function participantLabel(conv: AdminChatConversation) {
  const left = conv.sender
    ? `${conv.sender.firstName} (${conv.sender.email})`
    : conv.senderIdentity;
  const right = conv.recipient
    ? `${conv.recipient.firstName} (${conv.recipient.email})`
    : conv.recipientIdentity;
  return `${left} ↔ ${right}`;
}

function UserLink({
  id,
  name,
  isVip,
}: {
  id: string;
  name: string;
  isVip: boolean;
}) {
  const path = isVip ? `/creators/${id}` : `/users/${id}`;
  return (
    <Link
      to={path}
      className="font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
    >
      {name}
    </Link>
  );
}

export default function ChatLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [userIdA, setUserIdA] = useState("");
  const [userIdB, setUserIdB] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedRoom, setSelectedRoom] =
    useState<AdminChatConversation | null>(null);
  const [messagePage, setMessagePage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);

  const conversationsQuery = useQuery({
    queryKey: [
      "admin",
      "chat",
      "conversations",
      { page, search: debouncedSearch, userIdA, userIdB, from, to },
    ],
    queryFn: () =>
      listChatConversations({
        page,
        limit: LIMIT,
        search: debouncedSearch.trim() || undefined,
        userIdA: userIdA.trim() || undefined,
        userIdB: userIdB.trim() || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
      }),
  });

  const messagesQuery = useQuery({
    queryKey: [
      "admin",
      "chat",
      "messages",
      { roomName: selectedRoom?.roomName, messagePage },
    ],
    queryFn: () =>
      listChatMessages({
        roomName: selectedRoom!.roomName,
        page: messagePage,
        limit: MESSAGE_LIMIT,
      }),
    enabled: Boolean(selectedRoom?.roomName),
  });

  const conversations = conversationsQuery.data?.items ?? [];
  const messages = messagesQuery.data?.items ?? [];

  const openConversation = (conv: AdminChatConversation) => {
    setSelectedRoom(conv);
    setMessagePage(1);
  };

  const closeModal = () => {
    setSelectedRoom(null);
    setMessagePage(1);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PageMeta
        title="Chat logs | Rizz Outlet Admin"
        description="Archived in-call chat between users for moderation and support"
      />

      <div className="mb-6 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Chat logs
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          In-call messages are archived asynchronously — live chat is never
          blocked by storage.
        </p>
      </div>

      <div className="mb-5 grid shrink-0 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <Label>Search user</Label>
          <Input
            placeholder="Name or email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <Label>User A id</Label>
          <Input
            placeholder="Mongo user id"
            value={userIdA}
            onChange={(e) => {
              setUserIdA(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <Label>User B id</Label>
          <Input
            placeholder="Mongo user id"
            value={userIdB}
            onChange={(e) => {
              setUserIdB(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <Label>From date</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div>
          <Label>To date</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {conversationsQuery.isError && (
          <p className="p-5 text-sm text-error-500">
            {getApiErrorMessage(conversationsQuery.error, "Failed to load chats")}
          </p>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <th className={thClass}>Participants</th>
                <th className={thClass}>Room</th>
                <th className={thClass}>Messages</th>
                <th className={thClass}>First message</th>
                <th className={thClass}>Last message</th>
                <th className={thClass}>Preview</th>
                <th className={thClass} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversationsQuery.isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className={tdClass}>
                    Loading…
                  </TableCell>
                </TableRow>
              )}

              {!conversationsQuery.isLoading && conversations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className={tdClass}>
                    No archived chats found.
                  </TableCell>
                </TableRow>
              )}

              {conversations.map((conv) => (
                <TableRow key={conv.roomName}>
                  <TableCell className={tdClass}>
                    <div className="flex flex-col gap-1">
                      {conv.sender ? (
                        <UserLink
                          id={conv.sender.id}
                          name={conv.sender.firstName}
                          isVip={conv.sender.isVip}
                        />
                      ) : (
                        <span>{conv.senderIdentity}</span>
                      )}
                      {conv.recipient ? (
                        <UserLink
                          id={conv.recipient.id}
                          name={conv.recipient.firstName}
                          isVip={conv.recipient.isVip}
                        />
                      ) : (
                        <span>{conv.recipientIdentity}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className={`${tdClass} font-mono text-xs`}>
                    {conv.roomName}
                  </TableCell>
                  <TableCell className={tdClass}>
                    <Badge color="light">{conv.messageCount}</Badge>
                  </TableCell>
                  <TableCell className={tdClass}>
                    {formatEpoch(conv.firstSentAt)}
                  </TableCell>
                  <TableCell className={tdClass}>
                    {formatEpoch(conv.lastSentAt)}
                  </TableCell>
                  <TableCell className={`${tdClass} max-w-xs truncate`}>
                    <span className="text-gray-500 dark:text-gray-400">
                      {conv.lastMessage.senderIdentity}:
                    </span>{" "}
                    {conv.lastMessage.text}
                  </TableCell>
                  <TableCell className={tdClass}>
                    <Button size="sm" onClick={() => openConversation(conv)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {conversationsQuery.data && conversationsQuery.data.totalPages > 1 && (
          <div className="border-t border-gray-200 p-4 dark:border-gray-800">
            <Pagination
              page={page}
              totalPages={conversationsQuery.data.totalPages}
              total={conversationsQuery.data.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(selectedRoom)}
        onClose={closeModal}
        className="max-w-3xl p-0"
      >
        {selectedRoom && (
          <div className="flex max-h-[80vh] flex-col">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Chat thread
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {participantLabel(selectedRoom)}
              </p>
              <p className="mt-1 font-mono text-xs text-gray-400">
                {selectedRoom.roomName}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messagesQuery.isLoading && (
                <p className="text-sm text-gray-500">Loading messages…</p>
              )}
              {messagesQuery.isError && (
                <p className="text-sm text-error-500">
                  {getApiErrorMessage(messagesQuery.error, "Failed to load messages")}
                </p>
              )}
              {!messagesQuery.isLoading && messages.length === 0 && (
                <p className="text-sm text-gray-500">No messages in this room.</p>
              )}
              <ul className="space-y-3">
                {messages.map((msg) => (
                  <li
                    key={msg.id}
                    className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {msg.sender?.firstName ?? msg.senderIdentity}
                      </span>
                      <span>→</span>
                      <span>
                        {msg.recipient?.firstName ?? msg.recipientIdentity}
                      </span>
                      <span>·</span>
                      <time>{formatEpoch(msg.sentAt)}</time>
                    </div>
                    <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
                      {msg.text}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {messagesQuery.data && messagesQuery.data.totalPages > 1 && (
              <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
                <Pagination
                  page={messagePage}
                  totalPages={messagesQuery.data.totalPages}
                  total={messagesQuery.data.total}
                  onPageChange={setMessagePage}
                />
              </div>
            )}

            <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
              <Button variant="outline" onClick={closeModal}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
