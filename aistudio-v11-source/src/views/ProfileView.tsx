import React, { useEffect, useState } from "react";
import { useGov } from "../context/GovContext";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { LanguageCode, SessionInfo } from "../types";
import {
  User,
  ShieldCheck,
  KeyRound,
  MonitorSmartphone,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  LogOut,
} from "lucide-react";

export const ProfileView: React.FC = () => {
  const { user, roles, language, setLanguage, updateProfile, logout } = useGov();

  // Identity / Life Bio form
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [stateName, setStateName] = useState(user?.state || "");
  const [district, setDistrict] = useState(user?.district || "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Preferences form
  const [prefLang, setPrefLang] = useState<LanguageCode>(language);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [dashboardLayout, setDashboardLayout] = useState<"standard" | "compact" | "simple">("standard");
  const [themePref, setThemePref] = useState<"light" | "high-contrast">("light");
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [prefsNotice, setPrefsNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password rotation form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Active sessions
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.name || "");
      setPhone(user.phone || "");
      setStateName(user.state || "");
      setDistrict(user.district || "");
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const res = await fetch("/api/v1/preferences", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.preferences) {
        const p = data.preferences;
        if (p.preferredLanguage === "en" || p.preferredLanguage === "hi" || p.preferredLanguage === "mr" || p.preferredLanguage === "kn") {
          setPrefLang(p.preferredLanguage);
        }
        if (typeof p.notificationsEnabled === "boolean") setNotificationsEnabled(p.notificationsEnabled);
        if (p.dashboardLayout) setDashboardLayout(p.dashboardLayout);
        if (p.theme) setThemePref(p.theme);
      }
    } catch {
      // ignore initial preference load failure
    }
  };

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch("/api/v1/auth/sessions", { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      }
    } catch {
      // keep existing sessions empty if offline
    } finally {
      setIsLoadingSessions(false);
    }
  };

  useEffect(() => {
    void loadPreferences();
    void loadSessions();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setProfileNotice({ type: "error", text: "Display name is required." });
      return;
    }
    setIsSavingProfile(true);
    setProfileNotice(null);
    try {
      const ok = await updateProfile({
        name: displayName.trim(),
        phone: phone.trim(),
        state: stateName.trim(),
        district: district.trim(),
      });
      if (ok) {
        setProfileNotice({ type: "success", text: "Life Bio profile attributes updated and recorded in U-AUDIT." });
      } else {
        setProfileNotice({ type: "error", text: "Failed to update Life Bio profile. Check input lengths." });
      }
    } catch {
      setProfileNotice({ type: "error", text: "Network error saving Life Bio details." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrefs(true);
    setPrefsNotice(null);
    try {
      const res = await fetch("/api/v1/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredLanguage: prefLang,
          notificationsEnabled,
          dashboardLayout,
          theme: themePref,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPrefsNotice({ type: "error", text: data.error || "Could not save preferences." });
        return;
      }
      setLanguage(prefLang);
      setPrefsNotice({ type: "success", text: "Language and workspace preferences saved." });
    } catch {
      setPrefsNotice({ type: "error", text: "Network error while saving preferences." });
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);
    if (newPassword.length < 8) {
      setPasswordNotice({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordNotice({ type: "error", text: "New passwords do not match." });
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmNewPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPasswordNotice({ type: "error", text: data.error || "Password update failed." });
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordNotice({ type: "success", text: "Password rotated cleanly with scrypt verification." });
    } catch {
      setPasswordNotice({ type: "error", text: "Network error while changing password." });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleRevokeSession = async (session: SessionInfo) => {
    setRevokingId(session.id);
    try {
      const res = await fetch(`/api/v1/auth/sessions/${session.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        if (session.isCurrent) {
          await logout();
          return;
        }
        await loadSessions();
      }
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="ugov-app-page ugov-profile-page space-y-6">
      {/* Header Identity Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[#174EA6] text-white flex items-center justify-center shrink-0 font-display text-xl font-extrabold">
            {user?.name?.charAt(0).toUpperCase() || "C"}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-extrabold text-slate-900 tracking-tight">
                {user?.name || "Citizen Life Bio"}
              </h1>
              <Badge variant="info" size="sm">
                {user?.kycLevel || "Tier 1 (Basic)"}
              </Badge>
              {roles.map((r) => (
                <Badge key={r} variant="neutral" size="sm">
                  {r}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
              {user?.uId} • {user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Jurisdiction</span>
            <span className="font-semibold text-slate-800">
              {user?.district || "—"}, {user?.state || "India"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void logout()}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
          >
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main 2-Column Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Life Bio Details */}
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-[#174EA6]" />
            <h2 className="text-base font-extrabold text-slate-900">Personal Life Bio</h2>
          </div>

          {profileNotice && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                profileNotice.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {profileNotice.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{profileNotice.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <Input
              label="Full Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <Input
              label="Mobile Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98XXXXXXXX"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="State / Union Territory"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
              />
              <Input
                label="District"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving Profile..." : "Save Life Bio"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Preferences & Workspace Accessibility */}
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <SlidersHorizontal className="w-4 h-4 text-[#174EA6]" />
            <h2 className="text-base font-extrabold text-slate-900">Language & Workspace Preferences</h2>
          </div>

          {prefsNotice && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                prefsNotice.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {prefsNotice.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{prefsNotice.text}</span>
            </div>
          )}

          <form onSubmit={handleSavePreferences} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Interface Language
              </label>
              <select
                value={prefLang}
                onChange={(e) => setPrefLang(e.target.value as LanguageCode)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Dashboard Density
                </label>
                <select
                  value={dashboardLayout}
                  onChange={(e) => setDashboardLayout(e.target.value as any)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
                >
                  <option value="standard">Standard</option>
                  <option value="compact">Compact</option>
                  <option value="simple">Simple Citizen Mode</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contrast Mode
                </label>
                <select
                  value={themePref}
                  onChange={(e) => setThemePref(e.target.value as any)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#174EA6]"
                >
                  <option value="light">Standard Light</option>
                  <option value="high-contrast">High Contrast</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="rounded border-slate-300 text-[#174EA6] focus:ring-[#174EA6]"
              />
              <span>Enable in-app lifecycle and security alerts</span>
            </label>

            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" type="submit" disabled={isSavingPrefs}>
                {isSavingPrefs ? "Saving Preferences..." : "Save Preferences"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Bottom 2-Column Security Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Password Rotation */}
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <KeyRound className="w-4 h-4 text-[#174EA6]" />
            <h2 className="text-base font-extrabold text-slate-900">Change Account Password</h2>
          </div>

          {passwordNotice && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                passwordNotice.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {passwordNotice.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{passwordNotice.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3.5">
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              label="New Password (Min 8 characters)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
            />
            <div className="flex justify-end pt-2">
              <Button variant="primary" size="sm" type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </Card>

        {/* Active Sessions */}
        <Card variant="default" padding="lg" className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="w-4 h-4 text-[#174EA6]" />
              <h2 className="text-base font-extrabold text-slate-900">Active Sessions</h2>
            </div>
            <span className="text-xs font-semibold text-slate-500 tabular-nums">
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </span>
          </div>

          {isLoadingSessions ? (
            <p className="text-xs text-slate-500 py-6 text-center">Loading active session ledger...</p>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No active sessions returned.</p>
          ) : (
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#174EA6] shrink-0" />
                      <span className="font-mono font-bold text-slate-800 truncate tabular-nums">
                        {sess.ipAddress}
                      </span>
                      {sess.isCurrent && (
                        <Badge variant="success" size="sm">
                          Current Session
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{sess.userAgent}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">
                      Started: {new Date(sess.createdAt).toLocaleString()} • Expires:{" "}
                      {new Date(sess.expiresAt).toLocaleDateString()}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleRevokeSession(sess)}
                    disabled={revokingId === sess.id}
                  >
                    {revokingId === sess.id ? "Revoking..." : "Revoke"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
