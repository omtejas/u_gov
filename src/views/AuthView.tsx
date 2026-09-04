import React, { useState } from "react";
import { useGov } from "../context/GovContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  LogIn,
  Key,
  Info,
} from "lucide-react";

export const AuthView: React.FC = () => {
  const { login, register, authError, isLoadingAuth, setActiveTab } = useGov();
  const [tab, setTab] = useState<"login" | "register" | "simulation">("login");

  // Login Form State
  const [loginIdentifier, setLoginIdentifier] = useState<string>("citizen@u-gov.gov.in");
  const [loginPassword, setLoginPassword] = useState<string>("Citizen@UGov2026");

  // Registration Form State
  const [regIdentifier, setRegIdentifier] = useState<string>("");
  const [regDisplayName, setRegDisplayName] = useState<string>("");
  const [regPhone, setRegPhone] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>("");
  const [regState, setRegState] = useState<string>("Maharashtra");
  const [regDistrict, setRegDistrict] = useState<string>("Pune");
  const [termsAccepted, setTermsAccepted] = useState<boolean>(true);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(loginIdentifier, loginPassword);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await register({
      identifier: regIdentifier,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      displayName: regDisplayName,
      phone: regPhone,
      state: regState,
      district: regDistrict,
      termsAccepted,
    });
  };

  const fillQuickLogin = (role: "citizen" | "admin" | "auditor") => {
    setTab("login");
    if (role === "citizen") {
      setLoginIdentifier("citizen@u-gov.gov.in");
      setLoginPassword("Citizen@UGov2026");
    } else if (role === "admin") {
      setLoginIdentifier("admin@u-gov.gov.in");
      setLoginPassword("Admin@UGov2026");
    } else if (role === "auditor") {
      setLoginIdentifier("auditor@u-gov.gov.in");
      setLoginPassword("Auditor@UGov2026");
    }
  };

  return (
    <div className="w-full flex flex-col lg:flex-row min-h-[calc(100vh-10rem)] rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white my-2">
      {/* Left Branding Panel: Deep Navy Public Infrastructure Canvas */}
      <div className="relative w-full lg:w-[44%] bg-[#0b1f3a] text-white p-8 lg:p-12 flex flex-col justify-between overflow-hidden">
        {/* Subtle Sovereign Motifs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="sovereign-tricolor-bar absolute inset-x-0 top-0" />

        {/* Top: Architectural Identity */}
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="font-semibold tracking-wide text-amber-200 uppercase text-[11px]">
              U-IDENTITY Domain • Core Security Layer
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center font-extrabold text-white text-lg shadow-sm">
              U
            </div>
            <div>
              <span className="font-extrabold text-2xl tracking-tight text-white block leading-none">
                U-GOV
              </span>
              <span className="text-[10px] text-slate-300 tracking-widest uppercase font-semibold mt-0.5 block">
                Unified Governance & Citizen Services Platform
              </span>
            </div>
          </div>

          <div className="space-y-2 max-w-md pt-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
              One Citizen Account. <br />
              Connected Governance.
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Authenticate with your verified U-GOV citizen credentials to access application tracking, DigiVault credentials, and statutory public services.
            </p>
          </div>
        </div>

        {/* Center: Architecture & Security Highlights */}
        <div className="relative z-10 my-6 space-y-3">
          <div className="p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">Server-Managed Sessions</h5>
              <p className="text-[11px] text-slate-300 mt-0.5">
                HttpOnly, SameSite session cookies with instantaneous server revocation.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/5 backdrop-blur-sm border border-white/5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h5 className="text-xs font-bold text-white">scrypt Password Hashing</h5>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Cryptographically salted key derivation protects all citizen credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 text-[11px] text-slate-400 flex items-center justify-between border-t border-white/10 pt-4">
          <span>Security Architecture: Least Privilege RBAC</span>
          <span>Environment: Local Development</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="w-full lg:w-[56%] p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
        <div className="max-w-md w-full mx-auto space-y-5">
          {/* Header */}
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {tab === "login"
                ? "Sign In to U-GOV Account"
                : tab === "register"
                ? "Create Your Citizen Account"
                : "Simulated Identity Integration"}
            </h2>
            <p className="text-xs text-slate-500">
              {tab === "login"
                ? "Enter your verified email or U-ID to continue"
                : tab === "register"
                ? "Register a unified citizen account for public services"
                : "Prototype verification sandbox for external government identity APIs"}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setTab("login")}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "login"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              onClick={() => setTab("register")}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "register"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register</span>
            </button>
            <button
              onClick={() => setTab("simulation")}
              className={`py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                tab === "simulation"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Simulated</span>
            </button>
          </div>

          {/* Auth Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">Authentication Notice</span>
                <span>{authError}</span>
              </div>
            </div>
          )}

          {/* 1. Login Tab */}
          {tab === "login" && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <Input
                label="Email or U-ID Identifier"
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder="e.g. citizen@u-gov.gov.in"
                required
              />

              <Input
                label="Password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />

              <Button
                variant="primary"
                size="lg"
                type="submit"
                isLoading={isLoadingAuth}
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Sign In
              </Button>

              {/* Seeded Quick Demo Logins */}
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 block mb-2 text-center uppercase tracking-wider">
                  Test Credentials (RBAC Accounts)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => fillQuickLogin("citizen")}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition-colors text-center cursor-pointer"
                  >
                    Citizen
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickLogin("admin")}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-blue-700 transition-colors text-center cursor-pointer"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuickLogin("auditor")}
                    className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-emerald-700 transition-colors text-center cursor-pointer"
                  >
                    Auditor
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* 2. Registration Tab */}
          {tab === "register" && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <Input
                label="Full Legal Name"
                type="text"
                value={regDisplayName}
                onChange={(e) => setRegDisplayName(e.target.value)}
                placeholder="e.g. Ganesh Ramesh Gite"
                required
              />

              <Input
                label="Email / Identifier"
                type="email"
                value={regIdentifier}
                onChange={(e) => setRegIdentifier(e.target.value)}
                placeholder="e.g. user@domain.com"
                required
              />

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Password (min 8 chars)"
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Min 8 chars"
                  required
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="State"
                  type="text"
                  value={regState}
                  onChange={(e) => setRegState(e.target.value)}
                  required
                />
                <Input
                  label="District"
                  type="text"
                  value={regDistrict}
                  onChange={(e) => setRegDistrict(e.target.value)}
                  required
                />
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                  required
                />
                <span>
                  I accept the U-GOV Terms of Service and understand that data is stored in accordance with digital data protection principles.
                </span>
              </label>

              <Button
                variant="saffron"
                size="lg"
                type="submit"
                isLoading={isLoadingAuth}
                className="w-full"
                rightIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Create U-GOV Account
              </Button>
            </form>
          )}

          {/* 3. Simulation Sandbox Tab */}
          {tab === "simulation" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-300 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-900">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Prototype Sandbox Notice</span>
                </div>
                <p className="leading-relaxed">
                  Per project rules, external government identity systems (such as UIDAI Aadhaar e-KYC or DigiLocker OAuth) are demonstrated as <strong>simulated prototype integrations</strong> until statutory approvals and direct production API credentials are established.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="text-xs font-bold text-slate-700">Simulate Aadhaar OTP Flow</h5>
                <Input
                  label="Mock 12-Digit Aadhaar UID"
                  defaultValue="9823 4567 8921"
                  readOnly
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => fillQuickLogin("citizen")}
                >
                  Simulate OTP & Login as Citizen
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
