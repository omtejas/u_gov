import React, { useEffect, useRef, useState } from "react";
import { useGov } from "../context/GovContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import {
  ShieldCheck, Lock, ArrowRight, CheckCircle2, AlertCircle,
  UserPlus, LogIn, KeyRound, Info, Landmark, Fingerprint,
  Globe2, BadgeCheck, Sparkles, RefreshCw, X
} from "lucide-react";

type AuthTab = "login" | "register" | "simulation";
type LastAuthAttempt =
  | { type: "login"; identifier: string; password: string }
  | {
      type: "register";
      payload: {
        identifier: string;
        password: string;
        confirmPassword: string;
        displayName: string;
        phone?: string;
        state?: string;
        district?: string;
        termsAccepted: boolean;
      };
    }
  | { type: "google"; credential: string };

const STAGE_COPY: Record<string, string> = {
  validating: "Verifying citizen credentials with U-IDENTITY gateway…",
  establishing_session: "Establishing encrypted HttpOnly citizen session…",
  loading_workspace: "Loading DigiVault, applications, and audit workspace…",
};

export const AuthView: React.FC = () => {
  const { login, googleLogin, register, authError, clearAuthError, isLoadingAuth, authStage } = useGov();
  const [tab, setTab] = useState<AuthTab>("login");
  const [lastAttempt, setLastAttempt] = useState<LastAuthAttempt | null>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleLoginRef = useRef(googleLogin);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => { googleLoginRef.current = googleLogin; }, [googleLogin]);

  useEffect(() => {
    if (tab !== "login") return;
    let cancelled = false;
    const setupGoogleButton = async () => {
      try {
        const configResponse = await fetch("/api/v1/auth/google/config", { credentials: "same-origin" });
        const config = await configResponse.json();
        if (!configResponse.ok || !config.enabled || !config.clientId) {
          if (!cancelled) setGoogleEnabled(false);
          return;
        }
        const nonceResponse = await fetch("/api/v1/auth/google/nonce", { credentials: "same-origin" });
        const nonceData = await nonceResponse.json();
        if (!nonceResponse.ok || !nonceData.success || !nonceData.nonce) throw new Error("Could not start secure Google sign-in. Please refresh and try again.");
        if (cancelled) return;
        const render = () => {
          if (cancelled || !googleButtonRef.current || !(window as any).google?.accounts?.id) return;
          (window as any).google.accounts.id.initialize({
            client_id: config.clientId,
            nonce: nonceData.nonce,
            callback: async (response: { credential?: string }) => {
              if (!response.credential) {
                setGoogleError("Google did not return a valid sign-in credential.");
                return;
              }
              setGoogleError(null);
              setLastAttempt({ type: "google", credential: response.credential });
              const result = await googleLoginRef.current(response.credential);
              if (!result.success) setGoogleError(result.error || "Google sign-in failed.");
            },
          });
          googleButtonRef.current.innerHTML = "";
          (window as any).google.accounts.id.renderButton(googleButtonRef.current, {
            type: "standard", theme: "outline", size: "large", shape: "rectangular",
            text: "continue_with", logo_alignment: "left",
            width: Math.min(390, googleButtonRef.current.clientWidth || 390),
          });
          setGoogleEnabled(true);
        };
        if ((window as any).google?.accounts?.id) {
          render();
        } else {
          let script = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
          if (!script) {
            script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
          }
          script.addEventListener("load", render, { once: true });
          script.addEventListener("error", () => { if (!cancelled) setGoogleError("Google sign-in could not load. Check your connection."); }, { once: true });
        }
      } catch (error: any) {
        if (!cancelled) setGoogleError(error.message || "Google sign-in setup failed.");
      }
    };
    setupGoogleButton();
    return () => { cancelled = true; };
  }, [tab]);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [regIdentifier, setRegIdentifier] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [regState, setRegState] = useState("Maharashtra");
  const [regDistrict, setRegDistrict] = useState("Pune");
  const [termsAccepted, setTermsAccepted] = useState(true);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);
    setLastAttempt({ type: "login", identifier: loginIdentifier, password: loginPassword });
    await login(loginIdentifier, loginPassword);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoogleError(null);
    const payload = {
      identifier: regIdentifier,
      password: regPassword,
      confirmPassword: regConfirmPassword,
      displayName: regDisplayName,
      phone: regPhone,
      state: regState,
      district: regDistrict,
      termsAccepted,
    };
    setLastAttempt({ type: "register", payload });
    await register(payload);
  };

  const handleRetryAuth = async () => {
    if (isLoadingAuth) return;
    setGoogleError(null);
    clearAuthError();
    if (!lastAttempt) {
      if (tab === "login" && loginIdentifier && loginPassword) {
        await login(loginIdentifier, loginPassword);
      }
      return;
    }
    if (lastAttempt.type === "login") {
      await login(lastAttempt.identifier, lastAttempt.password);
    } else if (lastAttempt.type === "register") {
      await register(lastAttempt.payload);
    } else if (lastAttempt.type === "google") {
      const result = await googleLogin(lastAttempt.credential);
      if (!result.success) setGoogleError(result.error || "Google sign-in failed.");
    }
  };

  const handleDismissError = () => {
    clearAuthError();
    setGoogleError(null);
  };

  const fillQuickLogin = (role: "citizen" | "admin" | "auditor") => {
    const accounts = {
      citizen: ["citizen@u-gov.gov.in", "Citizen@UGov2026"],
      admin: ["admin@u-gov.gov.in", "Admin@UGov2026"],
      auditor: ["auditor@u-gov.gov.in", "Auditor@UGov2026"],
    } as const;
    clearAuthError();
    setGoogleError(null);
    setTab("login");
    setLoginIdentifier(accounts[role][0]);
    setLoginPassword(accounts[role][1]);
  };

  const switchTab = (next: AuthTab) => {
    clearAuthError();
    setGoogleError(null);
    setTab(next);
  };

  const activeError = authError || googleError;
  const activeStageLabel = authStage !== "idle" ? STAGE_COPY[authStage] : null;

  return (
    <main className="ugov-auth-page relative isolate my-2 min-h-[calc(100vh-8rem)] w-full overflow-hidden rounded-[28px] border border-slate-200/80 bg-[#F4F7FC] shadow-[0_24px_80px_-35px_rgba(15,35,75,.35)]">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-blue-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -right-28 h-[30rem] w-[30rem] rounded-full bg-amber-200/25 blur-3xl" />

      <div className="relative grid min-h-[calc(100vh-8rem)] lg:grid-cols-[.92fr_1.08fr]">
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#0B1F3A] px-7 py-8 text-white sm:px-10 lg:px-12 lg:py-11">
          <div className="absolute inset-0 opacity-[.12]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
          <div className="absolute -right-28 top-24 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -right-16 top-36 h-56 w-56 rounded-full border border-white/10" />
          <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[#174EA6]/50 blur-2xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 p-1.5 shadow-lg">
                <img src="/logo.png" alt="U-GOV emblem" className="h-full w-full object-contain" />
              </div>
              <div>
                <div className="text-xl font-black tracking-[.16em]">U-GOV</div>
                <div className="text-[9px] font-semibold uppercase tracking-[.2em] text-blue-100/75">Unified Governance</div>
              </div>
            </div>

            <div className="mt-16 max-w-lg space-y-5 sm:mt-20">
              <div className="text-[11px] font-bold uppercase tracking-[.17em] text-amber-300">
                Citizen-first digital governance
              </div>
              <h1 className="text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl">
                One identity.<br />
                <span className="text-[#F4C95D]">Every service.</span><br />
                A simpler India.
              </h1>
              <p className="max-w-md text-sm leading-7 text-blue-100/75">
                A unified digital gateway to discover public services, manage documents and follow application journeys — all from one secure workspace.
              </p>
            </div>

            <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-400/15 text-blue-200"><Fingerprint size={18} /></div>
                <div className="text-sm font-bold">Your identity, protected</div>
                <p className="mt-1 text-[11px] leading-5 text-blue-100/65">Secure sessions and role-based access controls.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-300/15 text-amber-200"><Landmark size={18} /></div>
                <div className="text-sm font-bold">Services in one place</div>
                <p className="mt-1 text-[11px] leading-5 text-blue-100/65">Explore services, documents and applications.</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-[10px] text-blue-100/55">
            <span className="flex items-center gap-2"><ShieldCheck size={13} /> Security-led experience</span>
            <span>U-GOV • Digital Public Services Prototype</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
          <div className="w-full max-w-[470px]">
            <div className="mb-7">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#174EA6]">
                <Sparkles size={14} /> Welcome to U-GOV
              </div>
              <h2 className="text-3xl font-black tracking-tight text-[#10233F] sm:text-[34px]">
                {tab === "login" ? "Welcome back" : tab === "register" ? "Create your account" : "Identity sandbox"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {tab === "login" ? "Sign in to continue to your citizen services workspace." : tab === "register" ? "Set up your citizen profile to get started with U-GOV." : "Explore the prototype identity verification experience."}
              </p>
            </div>

            <div className="mb-6 grid grid-cols-3 rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm">
              {([
                ["login", "Sign in", LogIn],
                ["register", "Sign up", UserPlus],
                ["simulation", "Sandbox", KeyRound],
              ] as const).map(([key, label, Icon]) => (
                <button key={key} type="button" onClick={() => switchTab(key)} className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-bold transition-all ${tab === key ? "bg-[#174EA6] text-white shadow-md shadow-blue-900/15" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}>
                  <Icon size={14} />{label}
                </button>
              ))}
            </div>

            {activeStageLabel && (
              <div
                role="status"
                aria-live="polite"
                className="mb-5 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-xs font-semibold text-[#10233F]"
              >
                <RefreshCw size={15} className="shrink-0 animate-spin text-[#174EA6]" />
                <span>{activeStageLabel}</span>
              </div>
            )}

            {activeError && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle size={17} className="mt-0.5 shrink-0 text-[#DC2626]" />
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wide text-[#DC2626]">
                        Authentication notice
                      </div>
                      <p className="mt-1 text-xs leading-5 text-rose-900">{activeError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDismissError}
                    aria-label="Dismiss authentication notice"
                    className="rounded-lg p-1 text-rose-500 transition hover:bg-rose-100 hover:text-rose-800"
                  >
                    <X size={15} />
                  </button>
                </div>
                {(lastAttempt || (tab === "login" && loginIdentifier && loginPassword)) && (
                  <div className="mt-3 flex items-center gap-2 pl-7">
                    <button
                      type="button"
                      onClick={handleRetryAuth}
                      disabled={isLoadingAuth}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw size={13} className={isLoadingAuth ? "animate-spin" : ""} />
                      Retry sign-in
                    </button>
                  </div>
                )}
              </div>
            )}

            {tab === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div ref={googleButtonRef} className="flex min-h-10 w-full justify-center" />
                  {googleEnabled === false && <p className="text-center text-[11px] text-slate-400">Google sign-in will be available after administrator configuration.</p>}
                </div>
                <div className="relative py-1 text-center"><div className="absolute inset-x-0 top-1/2 border-t border-slate-200" /><span className="relative bg-[#F4F7FC] px-3 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Or sign in with email</span></div>
                <Input label="Email address or U-ID" type="text" value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value)} placeholder="you@example.com" required />
                <Input label="Password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Enter your password" required />
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5"><Lock size={12} /> Protected sign-in</span>
                  <span>Use your registered credentials</span>
                </div>
                <Button variant="primary" size="lg" type="submit" isLoading={isLoadingAuth} className="!mt-5 w-full !rounded-xl !py-3.5" rightIcon={<ArrowRight size={16} />}>
                  {activeStageLabel || "Sign in securely"}
                </Button>

                <div className="pt-4">
                  <div className="relative mb-4 text-center"><div className="absolute inset-x-0 top-1/2 border-t border-slate-200" /><span className="relative bg-[#F4F7FC] px-3 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Demo access</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    {(["citizen", "admin", "auditor"] as const).map((role) => (
                      <button key={role} type="button" onClick={() => fillQuickLogin(role)} className="rounded-xl border border-slate-200 bg-white px-2 py-3 text-xs font-bold capitalize text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-[#174EA6] hover:shadow-md">{role}</button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-[10px] leading-5 text-slate-400">Demo accounts are for presentation and testing only.</p>
                </div>
              </form>
            )}

            {tab === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <Input label="Full name" type="text" value={regDisplayName} onChange={(e) => setRegDisplayName(e.target.value)} placeholder="Enter your full name" required />
                <Input label="Email address" type="email" value={regIdentifier} onChange={(e) => setRegIdentifier(e.target.value)} placeholder="you@example.com" required />
                <Input label="Mobile number (optional)" type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="Enter mobile number" />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Create password" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} placeholder="Minimum 8 characters" required />
                  <Input label="Confirm password" type="password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} placeholder="Re-enter password" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="State" type="text" value={regState} onChange={(e) => setRegState(e.target.value)} required />
                  <Input label="District" type="text" value={regDistrict} onChange={(e) => setRegDistrict(e.target.value)} required />
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-xs leading-5 text-slate-500">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500" required />
                  <span>I agree to the U-GOV terms and understand this is a demonstration platform.</span>
                </label>
                <Button variant="saffron" size="lg" type="submit" isLoading={isLoadingAuth} className="w-full !rounded-xl !py-3.5" rightIcon={<CheckCircle2 size={16} />}>Create citizen account</Button>
              </form>
            )}

            {tab === "simulation" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
                  <div className="mb-1 flex items-center gap-2 font-bold"><Info size={15} /> Prototype-only identity simulation</div>
                  External government identity services such as Aadhaar e-KYC and DigiLocker are not connected. This screen demonstrates the concept only.
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><Fingerprint size={17} className="text-[#174EA6]" /> Citizen verification demo</div>
                  <Input label="Mock identity reference" defaultValue="DEMO-UID-982345" readOnly />
                  <Button variant="outline" size="lg" className="mt-4 w-full" onClick={() => fillQuickLogin("citizen")}>Continue with demo citizen</Button>
                </div>
              </div>
            )}

            <div className="mt-7 rounded-2xl border border-slate-200/80 bg-white/70 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#174EA6]"><Globe2 size={17} /></div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-700">More sign-in options</div>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">Google sign-in is configured for this U-GOV deployment. Other providers are not enabled.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-md border px-2.5 py-1 text-[10px] font-semibold ${googleEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>Google · {googleEnabled ? "enabled" : googleEnabled === false ? "setup required" : "checking"}</span>
                    {["Microsoft", "Facebook", "X"].map((provider) => <span key={provider} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-400">{provider} · not enabled</span>)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-400">
              <BadgeCheck size={13} className="text-emerald-600" /> Secure session • Role-based access • U-GOV prototype
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};
