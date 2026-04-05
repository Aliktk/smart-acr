"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, ExternalLink, Info, MoreHorizontal, X, XCircle } from "lucide-react";
import { dismissNotification, getNotifications, markAllNotificationsRead, markNotificationRead } from "@/api/client";
import type { NotificationItem } from "@/types/contracts";
import { useShell } from "@/hooks/useShell";

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

export function NotificationPanel() {
  const queryClient = useQueryClient();
  const { notificationPanelOpen, setNotificationPanelOpen } = useShell();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => {
      setOpenMenuId(null);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const notifications = data?.items ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <aside
      aria-hidden={!notificationPanelOpen}
      className={`pointer-events-none fixed bottom-0 right-0 top-14 z-40 hidden w-[320px] border-l border-[#D7DEEA] bg-[#F8FAFD] shadow-[-16px_0_36px_rgba(15,23,42,0.16)] transition-transform duration-300 xl:flex ${
        notificationPanelOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full"
      }`}
    >
      <div className="flex w-full flex-col">
        <div className="bg-[#1A1C6E] px-4 py-3.5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-white" />
              <h3 className="text-base font-semibold text-white">Notifications</h3>
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setNotificationPanelOpen(false)}
              className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-[#E4E8F0] bg-[#F3F4F6] px-4 py-2.5 text-sm text-[#6B7280]">
          <span>
            {notifications.length} total · {unreadCount} unread
          </span>
          <button
            type="button"
            disabled={unreadCount === 0 || markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
            className="font-medium text-[#0095D9] disabled:cursor-not-allowed disabled:text-[#94A3B8]"
          >
            Mark all read
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F8FAFD] px-3 py-2.5">
          <div className="space-y-1.5">
            {notifications.map((notification) => {
              const visuals = getNotificationVisuals(notification);
              const Icon = visuals.icon;
              const menuOpen = openMenuId === notification.id;

              return (
                <div
                  key={notification.id}
                  className="group relative rounded-[16px] border border-transparent bg-white px-3.5 py-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition hover:border-[#D7DEEA]"
                >
                  <Link
                    href={notification.acrId ? `/acr/${notification.acrId}` : "/notifications"}
                    onClick={() => {
                      setNotificationPanelOpen(false);
                      if (!notification.read) {
                        markReadMutation.mutate(notification.id);
                      }
                    }}
                    className="block"
                  >
                    <div className="flex items-start gap-3 pr-8">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${visuals.iconWrap}`}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-[#111827]">{notification.title}</p>
                          {!notification.read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#0095D9]" /> : null}
                        </div>
                        <p className="mt-0.5 text-sm leading-5 text-[#6B7280]">{notification.message}</p>
                        <p className="mt-1.5 text-xs text-[#9CA3AF]">{notification.time}</p>
                      </div>
                    </div>
                  </Link>

                  <div className="absolute right-2 top-2">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId((current) => (current === notification.id ? null : notification.id))}
                      className={`rounded-full p-1.5 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#111827] ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      aria-label="Notification actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen ? (
                      <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white py-1 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                        {!notification.read ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              markReadMutation.mutate(notification.id);
                            }}
                            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-[#334155] transition hover:bg-[#F8FAFC]"
                          >
                            <CheckCircle2 size={15} />
                            Mark as read
                          </button>
                        ) : null}
                        <Link
                          href={notification.acrId ? `/acr/${notification.acrId}` : "/notifications"}
                          onClick={() => {
                            setOpenMenuId(null);
                            setNotificationPanelOpen(false);
                          }}
                          className="flex items-center gap-2 px-3.5 py-2 text-sm text-[#334155] transition hover:bg-[#F8FAFC]"
                        >
                          <ExternalLink size={15} />
                          Open notification
                        </Link>
                        <button
                          type="button"
                          onClick={() => dismissMutation.mutate(notification.id)}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-[#BE123C] transition hover:bg-[#FFF1F2]"
                        >
                          <XCircle size={15} />
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#E4E8F0] bg-white px-4 py-3">
          <Link
            href="/notifications"
            onClick={() => setNotificationPanelOpen(false)}
            className="block text-center text-sm font-semibold text-[#0095D9]"
          >
            View all notifications →
          </Link>
        </div>
      </div>
    </aside>
  );
}
