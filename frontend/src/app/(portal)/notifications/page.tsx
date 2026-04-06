"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Info, Search, X, XCircle } from "lucide-react";
import { dismissNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from "@/api/client";
import type { NotificationItem } from "@/types/contracts";

function getNotificationVisuals(notification: NotificationItem) {
  switch (notification.type) {
    case "warning":
      return {
        icon: AlertTriangle,
        iconWrap: "bg-[#FFF7ED] text-[#F59E0B]",
      };
    case "success":
      return {
        icon: CheckCircle2,
        iconWrap: "bg-[#ECFDF5] text-[#16A34A]",
      };
    case "danger":
      return {
        icon: X,
        iconWrap: "bg-[#FEF2F2] text-[#EF4444]",
      };
    case "info":
    default:
      return {
        icon: Info,
        iconWrap: "bg-[#EFF6FF] text-[#3B82F6]",
      };
  }
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [queryText, setQueryText] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotificationItem["type"] | "all">("all");
  const [readFilter, setReadFilter] = useState<"read" | "unread" | "all">("all");
  const [linkedFilter, setLinkedFilter] = useState<"linked" | "system" | "all">("all");
  const deferredQuery = useDeferredValue(queryText);
  const { data } = useQuery({
    queryKey: ["notifications", { query: deferredQuery, type: typeFilter, read: readFilter, linked: linkedFilter }],
    queryFn: () =>
      getNotifications({
        query: deferredQuery,
        type: typeFilter,
        read: readFilter,
        linked: linkedFilter,
      }),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const mutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = data?.items ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const typeCounts = useMemo(
    () => ({
      all: notifications.length,
      info: notifications.filter((notification) => notification.type === "info").length,
      warning: notifications.filter((notification) => notification.type === "warning").length,
      success: notifications.filter((notification) => notification.type === "success").length,
      danger: notifications.filter((notification) => notification.type === "danger").length,
    }),
    [notifications],
  );

  return (
    <div className="mx-auto max-w-screen-xl space-y-4 p-5">
      <section className="overflow-hidden rounded-[24px] border border-[#D7DEEA] bg-white shadow-sm">
        <div className="bg-[#1A1C6E] px-5 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-white">Notifications</h1>
            </div>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-sm font-semibold">
              {unreadCount} unread
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E8F0] bg-[#F3F4F6] px-5 py-3 text-sm text-[#6B7280]">
          <span>{notifications.length} total notifications</span>
          <button
            type="button"
            disabled={unreadCount === 0 || markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
            className="font-semibold text-[#0095D9] disabled:cursor-not-allowed disabled:text-[#94A3B8]"
          >
            Mark all read
          </button>
        </div>

        <div className="grid gap-3 border-b border-[#E4E8F0] bg-white px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,180px))]">
          <label className="relative block">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Search title, message, or ACR number"
              className="w-full rounded-2xl border border-[#D8DEE8] bg-[#F8FAFC] py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10"
            />
          </label>

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as NotificationItem["type"] | "all")}
            className="rounded-2xl border border-[#D8DEE8] bg-[#F8FAFC] px-4 py-2.5 text-sm outline-none transition focus:border-[#0095D9] focus:bg-white"
          >
            <option value="all">All types ({typeCounts.all})</option>
            <option value="info">Info ({typeCounts.info})</option>
            <option value="warning">Warning ({typeCounts.warning})</option>
            <option value="success">Success ({typeCounts.success})</option>
            <option value="danger">Danger ({typeCounts.danger})</option>
          </select>

          <select
            value={readFilter}
            onChange={(event) => setReadFilter(event.target.value as "read" | "unread" | "all")}
            className="rounded-2xl border border-[#D8DEE8] bg-[#F8FAFC] px-4 py-2.5 text-sm outline-none transition focus:border-[#0095D9] focus:bg-white"
          >
            <option value="all">All status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>

          <select
            value={linkedFilter}
            onChange={(event) => setLinkedFilter(event.target.value as "linked" | "system" | "all")}
            className="rounded-2xl border border-[#D8DEE8] bg-[#F8FAFC] px-4 py-2.5 text-sm outline-none transition focus:border-[#0095D9] focus:bg-white"
          >
            <option value="all">All sources</option>
            <option value="linked">Linked to ACR</option>
            <option value="system">System only</option>
          </select>
        </div>

        <div className="space-y-2.5 bg-[#F8FAFD] p-4">
          {notifications.length === 0 ? (
            <div className="rounded-[18px] bg-white px-4 py-10 text-center text-sm text-[#64748B] shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
              No notifications match the current filters.
            </div>
          ) : null}
          {notifications.map((notification) => {
            const visuals = getNotificationVisuals(notification);
            const Icon = visuals.icon;

            return (
              <div key={notification.id} className="rounded-[18px] bg-[#1A1C6E] px-4 py-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${visuals.iconWrap}`}>
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-white">{notification.title}</p>
                        {!notification.read ? <span className="h-2.5 w-2.5 rounded-full bg-[#0095D9]" /> : null}
                      </div>
                      <p className="mt-0.5 text-sm leading-5 text-white/88">{notification.message}</p>
                      <p className="mt-1.5 text-xs text-white/60">{notification.time}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {notification.acrId ? (
                      <Link href={`/acr/${notification.acrId}`} className="text-sm font-semibold text-white">
                        Open record
                      </Link>
                    ) : null}
                    {!notification.read ? (
                      <button
                        type="button"
                        onClick={() => mutation.mutate(notification.id)}
                        className="rounded-full bg-[#1A1C6E] px-4 py-2 text-xs font-semibold text-white"
                      >
                        Mark read
                      </button>
                    ) : (
                      <span className="rounded-full bg-[#ECFDF5] px-4 py-2 text-xs font-semibold text-[#15803D]">Read</span>
                    )}
                    <button
                      type="button"
                      onClick={() => dismissMutation.mutate(notification.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-[#FECACA] bg-[#FFF1F2] px-3 py-2 text-xs font-semibold text-[#BE123C]"
                    >
                      <XCircle size={14} />
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
