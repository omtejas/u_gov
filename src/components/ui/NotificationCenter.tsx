import React, { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck, Trash2, ExternalLink, AlertTriangle, CheckCircle, Info, AlertCircle, Clock } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import { useGov } from "../../context/GovContext";

const TYPE_ICONS: Record<string, React.ElementType> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  alert: AlertCircle,
  status: Clock,
};

const TYPE_COLORS: Record<string, string> = {
  info: "text-blue-600 bg-blue-50",
  success: "text-emerald-600 bg-emerald-50",
  warning: "text-amber-600 bg-amber-50",
  alert: "text-red-600 bg-red-50",
  status: "text-slate-600 bg-slate-100",
};

export const NotificationCenter: React.FC = () => {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification } = useNotifications();
  const { setActiveTab } = useGov();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const formatTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label={`Notifications — ${unreadCount} unread`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 ring-2 ring-white flex items-center justify-center text-[9px] font-bold text-white px-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200/80 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title="Mark all as read"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-[11px] flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => { setActiveTab("notifications"); setIsOpen(false); }}
                title="View all"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No notifications</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const Icon = TYPE_ICONS[notif.type] || Info;
                const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.status;
                return (
                  <div
                    key={notif.id}
                    className={`flex gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50/70 transition-colors group ${
                      !notif.read ? "bg-blue-50/30" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => markRead(notif.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[13px] leading-snug ${!notif.read ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>
                          {notif.title}
                        </p>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{notif.message}</p>
                      <span className="text-[11px] text-slate-400 mt-1 block">{formatTime(notif.createdAt)}</span>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      title="Delete notification"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0 mt-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 text-center">
              <button
                onClick={() => { setActiveTab("notifications"); setIsOpen(false); }}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
