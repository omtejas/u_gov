import React, { useState, useEffect } from "react";
import {
  Bell, X, CheckCheck, Trash2, AlertCircle, CheckCircle, Info, AlertTriangle, Clock, Filter, RefreshCw
} from "lucide-react";
import { useNotifications } from "../context/NotificationContext";

const TYPE_ICONS: Record<string, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  alert: AlertCircle,
  status: Clock,
};

const TYPE_COLORS: Record<string, string> = {
  info: "text-blue-600 bg-blue-50 border-blue-200",
  success: "text-emerald-600 bg-emerald-50 border-emerald-200",
  warning: "text-amber-600 bg-amber-50 border-amber-200",
  alert: "text-red-600 bg-red-50 border-red-200",
  status: "text-slate-600 bg-slate-50 border-slate-200",
};

export const NotificationsView: React.FC = () => {
  const { notifications, unreadCount, isLoading, markRead, markAllRead, deleteNotification, fetchNotifications } =
    useNotifications();
  const [filter, setFilter] = useState<"all" | "unread" | "info" | "success" | "warning" | "alert">("all");

  useEffect(() => { fetchNotifications(); }, []);

  const filtered =
    filter === "all"
      ? notifications
      : filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications.filter((n) => n.type === filter);

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bell className="w-5 h-5 text-[#0b1f3a]" />
            <h1 className="text-2xl font-extrabold text-[#0b1f3a]">Notifications</h1>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">Alerts, status updates, and system messages for your account.</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-colors border border-blue-200"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
          <button
            onClick={fetchNotifications}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-semibold transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-400" />
        {(["all", "unread", "alert", "warning", "success", "info"] as const).map((f) => {
          const count =
            f === "all"
              ? notifications.length
              : f === "unread"
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => n.type === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                filter === f ? "bg-[#0b1f3a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f} ({count})
            </button>
          );
        })}
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Loading notifications…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No notifications</p>
          <p className="text-slate-400 text-sm mt-1">
            {filter === "unread" ? "All notifications are read." : "You have no notifications in this category."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((notif) => {
            const Icon = TYPE_ICONS[notif.type] || Info;
            const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.status;
            return (
              <div
                key={notif.id}
                className={`flex gap-4 p-4 rounded-2xl border transition-all group hover:shadow-sm ${
                  !notif.read ? "bg-blue-50/40 border-blue-200/60" : "bg-white border-slate-200/80"
                }`}
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0" onClick={() => !notif.read && markRead(notif.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm leading-snug ${!notif.read ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                      {notif.title}
                      {!notif.read && (
                        <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-blue-500 align-middle" />
                      )}
                    </p>
                    <span className="text-[11px] text-slate-400 shrink-0">{formatTime(notif.createdAt)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{notif.message}</p>
                  {notif.relatedRef && (
                    <p className="text-[11px] text-slate-400 mt-1.5 font-mono">Ref: {notif.relatedRef}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  {!notif.read && (
                    <button
                      onClick={() => markRead(notif.id)}
                      title="Mark as read"
                      className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-100 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notif.id)}
                    title="Delete"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
