"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      setOpenMenuId(null);
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

  useEffect(() => {
    if (!notificationPanelOpen) {
      setOpenMenuId(null);
    }
  }, [notificationPanelOpen]);

  function closePanel() {
    setOpenMenuId(null);
    setNotificationPanelOpen(false);
  }

  function openNotification(notification: NotificationItem, destination?: string) {
    closePanel();
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }
    router.push(destination ?? (notification.acrId ? `/acr/${notification.acrId}` : "/notifications"));
  }

  return (
    <>
      <button
        type="button"
        aria-hidden={!notificationPanelOpen}
        tabIndex={notificationPanelOpen ? 0 : -1}
        onClick={closePanel}
        className={`fixed inset-y-14 left-[var(--active-sidebar-width,0px)] right-[320px] z-30 hidden bg-transparent xl:block ${
          notificationPanelOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      />
      <aside
        aria-hidden={!notificationPanelOpen}
        className={`fixed bottom-0 right-0 top-14 z-40 hidden w-[320px] border-l border-[var(--fia-gray-200)] bg-[var(--background)] shadow-[-16px_0_36px_rgba(15,23,42,0.16)] transition-transform duration-300 dark:shadow-[-16px_0_36px_rgba(0,0,0,0.4)] xl:flex ${
          notificationPanelOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
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
              onClick={closePanel}
              className="rounded-full p-1 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-[var(--fia-gray-200)] bg-[var(--fia-gray-100)] px-4 py-2.5 text-sm text-[var(--fia-gray-600)]">
          <span>
            {notifications.length} total · {unreadCount} unread
          </span>
          <button
            type="button"
            disabled={unreadCount === 0 || markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
            className="font-medium text-[var(--fia-cyan)] disabled:cursor-not-allowed disabled:text-[var(--fia-gray-400)]"
          >
            {markAllMutation.isPending ? "Updating..." : "Mark all read"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-[var(--background)] px-3 py-2.5">
          <div className="space-y-1.5">
            {notifications.map((notification) => {
              const visuals = getNotificationVisuals(notification);
              const Icon = visuals.icon;
              const menuOpen = openMenuId === notification.id;

              return (
                <div
                  key={notification.id}
                  className="group relative rounded-[16px] border border-transparent bg-[var(--card)] px-3.5 py-3.5 shadow-[0_8px_20px_rgba(15,23,42,0.05)] transition hover:border-[var(--fia-gray-200)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
                >
                  <button
                    type="button"
                    onClick={() => openNotification(notification)}
                    className="block w-full text-left"
                  >
                    <div className="flex items-start gap-3 pr-8">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${visuals.iconWrap}`}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-[var(--fia-gray-900)]">{notification.title}</p>
                          {!notification.read ? <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--fia-cyan)]" /> : null}
                        </div>
                        <p className="mt-0.5 text-sm leading-5 text-[var(--fia-gray-600)]">{notification.message}</p>
                        <p className="mt-1.5 text-xs text-[var(--fia-gray-400)]">{notification.time}</p>
                      </div>
                    </div>
                  </button>

                  <div className="absolute right-2 top-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenuId((current) => (current === notification.id ? null : notification.id));
                      }}
                      className={`rounded-full p-1.5 text-[var(--fia-gray-500)] transition hover:bg-[var(--fia-gray-100)] hover:text-[var(--fia-gray-900)] ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                      aria-label="Notification actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen ? (
                      <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] py-1 shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.4)]">
                        {!notification.read ? (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              markReadMutation.mutate(notification.id);
                            }}
                            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]"
                          >
                            <CheckCircle2 size={15} />
                            Mark as read
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            openNotification(notification);
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]"
                        >
                          <ExternalLink size={15} />
                          Open notification
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            closePanel();
                            router.push("/notifications");
                          }}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]"
                        >
                          <Bell size={15} />
                          View all
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissMutation.mutate(notification.id)}
                          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-[#DC2626] transition hover:bg-[var(--fia-danger-bg)]"
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

        <div className="border-t border-[var(--fia-gray-200)] bg-[var(--card)] px-4 py-3">
          <button
            type="button"
            onClick={() => {
              closePanel();
              router.push("/notifications");
            }}
            className="block w-full text-center text-sm font-semibold text-[var(--fia-cyan)]"
          >
            View all notifications →
          </button>
        </div>
      </div>
      </aside>
    </>
  );
}
