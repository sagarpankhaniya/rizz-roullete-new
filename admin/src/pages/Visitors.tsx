import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageMeta from "../components/common/PageMeta";
import Input from "../components/form/input/InputField";
import Label from "../components/form/Label";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { getVisitorAnalytics } from "../api/analytics";
import { getApiErrorMessage } from "../api/auth";
import { formatDate } from "../lib/format";

const thClass =
  "text-theme-xs bg-gray-50 px-5 py-3 text-start font-medium text-gray-500 dark:bg-gray-900 dark:text-gray-400";
const tdClass = "px-5 py-4 text-sm text-gray-700 dark:text-gray-300";

function toInputDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultFromDate() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return toInputDate(date);
}

export default function Visitors() {
  const [from, setFrom] = useState(defaultFromDate);
  const [to, setTo] = useState(() => toInputDate(new Date()));

  const query = useQuery({
    queryKey: ["admin", "analytics", "visitors", from, to],
    queryFn: () => getVisitorAnalytics({ from, to }),
    enabled: Boolean(from && to),
  });

  const series = query.data?.series ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <PageMeta
        title="Visitors | Rizz Outlet Admin"
        description="Day-wise unique visitor analytics"
      />

      <div className="mb-6 shrink-0">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Visitors
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Unique visitors by day
        </p>
      </div>

      <div className="mb-5 grid shrink-0 gap-4 sm:grid-cols-2 lg:max-w-xl">
        <div>
          <Label>From date</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label>To date</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      {query.data && (
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          {query.data.totalUniqueVisitors} unique visitors in selected range
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {query.isLoading && (
          <p className="p-5 text-sm text-gray-500 dark:text-gray-400">
            Loading visitors...
          </p>
        )}

        {query.isError && (
          <p className="p-5 text-sm text-error-500">
            {getApiErrorMessage(query.error, "Failed to load visitors")}
          </p>
        )}

        {query.data && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Unique visitors</th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...series].reverse().map((row) => (
                  <TableRow key={row.label}>
                    <td className={tdClass}>{formatDate(row.label)}</td>
                    <td className={tdClass}>{row.visitors}</td>
                  </TableRow>
                ))}
                {series.length === 0 && (
                  <TableRow>
                    <td
                      colSpan={2}
                      className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No visitors in this date range
                    </td>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
