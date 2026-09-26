import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  User as UserIcon,
  ChevronRight,
  ChevronLeft,
  Lock,
  LogOut,
  Syringe,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
  UserPlus,
  WifiOff,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase, ensureSession, isSupabaseConfigured } from "./supabase";
import { fetchWorkers, fetchSettings, DEFAULT_SETTINGS } from "./db";
import type { AppSettings } from "./db";
import type { AshaWorker, User } from "./types";
import { friendlyDbError } from "./utils";
import { AshaDashboard } from "./components/AshaDashboard";
import { AdminDashboard } from "./components/AdminDashboard";
import { ToastProvider, useToast } from "./components/Toast";
import { AnimatedTabs } from "./components/ui";

const ASHA_PROFILE_KEY = "asha_profile";

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}

function Shell() {
  const toast = useToast();
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupabaseConfigured) {
        setBootError("SETUP_MISSING");
        setBooting(false);
        return;
      }
      const { session: s, error } = await ensureSession();
      if (cancelled) return;
      if (error || !s) {
        setBootError("ANON_DISABLED");
        setBooting(false);
        return;
      }
      setSession(s);
      try {
        const st = await fetchSettings();
        if (!cancelled) setSettings(st);
      } catch {
        /* keep defaults */
      }
      try {
        const saved = localStorage.getItem(ASHA_PROFILE_KEY);
        if (saved) setProfile(JSON.parse(saved));
      } catch {
        /* ignore */
      }
      setBooting(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      if (!s) {
        setProfile(null);
        setSession(null); // drop the stale session so the login screen waits for a fresh one
        try {
          localStorage.removeItem(ASHA_PROFILE_KEY);
        } catch {
          /* ignore */
        }
        const { session: an } = await ensureSession();
        if (!cancelled) setSession(an);
      } else {
        setSession(s);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = !!session && !session.user.is_anonymous && !!session.user.email;

  const handleLogout = async () => {
    if (isAdmin) {
      try {
        await supabase.auth.signOut();
        toast("लॉग आउट यशस्वी.", "info");
      } catch {
        toast("लॉग आउट करताना त्रुटी आली.", "error");
      }
      return;
    }
    // ASHA login is PIN-based (localStorage) on top of a shared anonymous
    // session — signing out would destroy that session and leave the login
    // screen with no access to the worker list. Just clear the profile.
    setProfile(null);
    try {
      localStorage.removeItem(ASHA_PROFILE_KEY);
    } catch {
      /* ignore */
    }
    toast("लॉग आउट यशस्वी.", "info");
  };

  if (booting) return <BootScreen />;

  if (bootError) return <BootErrorScreen kind={bootError} />;

  if (!isAdmin && !profile) {
    return (
      <LoginScreen
        settings={settings}
        sessionUserId={session?.user?.id ?? null}
        onAshaLogin={(w) => {
          const u: User = { id: w.id, name: w.name, role: "ASHA" };
          try {
            localStorage.setItem(ASHA_PROFILE_KEY, JSON.stringify(u));
          } catch {
            /* ignore */
          }
          setProfile(u);
        }}
      />
    );
  }

  const user: User = isAdmin
    ? { id: session!.user.id, name: "आरोग्य सेवक", role: "ADMIN" }
    : profile!;

  return (
    <div className="min-h-screen bg-[#f2f7f4] font-sans text-slate-800">
      <Header
        user={user}
        adminEmail={isAdmin ? session!.user.email ?? "" : ""}
        settings={settings}
        onLogout={handleLogout}
      />
      <AnimatePresence mode="wait">
        <motion.main
          key={user.role}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8"
        >
          {user.role === "ADMIN" ? (
            <AdminDashboard settings={settings} onSettingsSaved={setSettings} />
          ) : (
            <AshaDashboard user={user} />
          )}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Boot / error screens                                                */
/* ------------------------------------------------------------------ */

function BootScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-emerald-950">
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [1, 0.75, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-emerald-900 shadow-2xl ring-4 ring-amber-400/70"
      >
        <Syringe size={36} />
      </motion.div>
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.8, repeat: Infinity }}
        className="mt-6 text-lg font-bold text-emerald-100"
      >
        लोड होत आहे...
      </motion.p>
    </div>
  );
}

function BootErrorScreen({ kind }: { kind: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-emerald-950 p-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl sm:p-8"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <WifiOff size={26} />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">कनेक्शन सेटअप बाकी आहे</h2>
        {kind === "SETUP_MISSING" ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            ॲपची Supabase माहिती (.env फाईल) सापडली नाही. कृपया SETUP.md मधील पायरी १
            पूर्ण करा आणि ॲप पुन्हा उघडा.
          </p>
        ) : (
          <div className="mt-3 text-left text-sm leading-relaxed text-slate-500">
            <p className="font-bold text-slate-700">Supabase मध्ये हे एकदा चालू करा:</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>Supabase Dashboard → Authentication → Sign In / Providers</li>
              <li>
                <b>"Allow anonymous sign-ins"</b> हे ON करा
              </li>
              <li>ॲप रिफ्रेश करा</li>
            </ol>
          </div>
        )}
        <button
          onClick={() => window.location.reload()}
          className="mt-6 w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-700/30 transition hover:bg-emerald-800 active:scale-95"
        >
          पुन्हा प्रयत्न करा
        </button>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header({
  user,
  adminEmail,
  settings,
  onLogout,
}: {
  user: User;
  adminEmail: string;
  settings: AppSettings;
  onLogout: () => void;
}) {
  return (
    <motion.header
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="sticky top-0 z-40 overflow-hidden bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 text-white shadow-xl"
    >
      <div className="dot-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ rotate: 12, scale: 1.06 }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-emerald-900 shadow-lg ring-[3px] ring-amber-400"
          >
            <Syringe size={24} />
          </motion.div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-300 uppercase sm:text-[11px]">
              सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन
            </p>
            <h1 className="text-lg leading-tight font-extrabold sm:text-2xl">
              लसीकरण ड्यू लिस्ट संकलन
            </h1>
            <p className="mt-0.5 text-[11px] text-emerald-200 sm:text-xs">
              प्राथमिक आरोग्य केंद्र: {settings.phcName} | उपकेंद्र: {settings.subcenterName}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 border-t border-white/10 pt-3 md:border-t-0 md:pt-0">
          <div className="flex items-center gap-2 rounded-full bg-white/10 py-1.5 pr-1.5 pl-3 ring-1 ring-white/15 backdrop-blur">
            <UserIcon size={15} className="text-emerald-200" />
            <span className="max-w-[130px] truncate text-sm font-bold sm:max-w-[200px]">
              {user.name}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase ${
                user.role === "ADMIN"
                  ? "bg-amber-400 text-emerald-950"
                  : "bg-emerald-400 text-emerald-950"
              }`}
            >
              {user.role === "ADMIN" ? "Admin" : "ASHA"}
            </span>
          </div>
          {adminEmail && (
            <span className="hidden text-[11px] text-emerald-200/80 lg:inline">{adminEmail}</span>
          )}
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-4 py-1.5 text-sm font-bold text-white shadow-lg shadow-red-950/40 ring-1 ring-red-400/40 transition hover:bg-red-500"
          >
            <LogOut size={15} />
            लॉग आउट
          </motion.button>
        </div>
      </div>
    </motion.header>
  );
}

/* ------------------------------------------------------------------ */
/* Login screen                                                        */
/* ------------------------------------------------------------------ */

type LoginTab = "ASHA" | "ADMIN" | "REGISTER";

function LoginScreen({
  settings,
  sessionUserId,
  onAshaLogin,
}: {
  settings: AppSettings;
  sessionUserId: string | null;
  onAshaLogin: (w: AshaWorker) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<LoginTab>("ASHA");
  const [workers, setWorkers] = useState<AshaWorker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [workersError, setWorkersError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [selected, setSelected] = useState<AshaWorker | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [shake, setShake] = useState(0);

  // Admin form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminBusy, setAdminBusy] = useState(false);

  // Admin registration form
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regPw2, setRegPw2] = useState("");
  const [showRegPw, setShowRegPw] = useState(false);
  const [regError, setRegError] = useState("");
  const [regBusy, setRegBusy] = useState(false);

  // The worker list needs an active session (anonymous is fine). Right after
  // a logout there is briefly no session — wait for the fresh one instead of
  // fetching without auth and showing a permanently empty list.
  useEffect(() => {
    let cancelled = false;
    setWorkers([]);
    setWorkersError(false);
    setLoadingWorkers(true);
    if (!sessionUserId) return; // session not ready yet (e.g. just logged out)
    (async () => {
      try {
        const list = await fetchWorkers();
        if (!cancelled) setWorkers(list);
      } catch (e) {
        if (!cancelled) {
          setWorkersError(true);
          toast(friendlyDbError(e), "error");
        }
      } finally {
        if (!cancelled) setLoadingWorkers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast, sessionUserId, retryTick]);

  const submitPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    if (pin === selected.pin) {
      setPinError("");
      onAshaLogin(selected);
    } else {
      setPinError("चुकीचा पिन! कृपया पुन्हा प्रयत्न करा.");
      setShake((s) => s + 1);
      setPin("");
    }
  };

  const submitAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      toast("प्रशासक म्हणून लॉगिन यशस्वी!", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/invalid login credentials/i.test(msg))
        setAdminError("ईमेल किंवा पासवर्ड चुकीचा आहे.");
      else setAdminError(friendlyDbError(err));
    } finally {
      setAdminBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    if (regPw.length < 6) {
      setRegError("पासवर्ड किमान ६ अक्षरी असावा.");
      return;
    }
    if (regPw !== regPw2) {
      setRegError("दोन्ही पासवर्ड जुळत नाहीत.");
      return;
    }
    setRegBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPw,
      });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation is ON — ask them to confirm first.
        toast("नोंदणी झाली! ईमेलमधील लिंकवर क्लिक करून खाते सक्रिय करा.", "info");
        setTab("ADMIN");
        setEmail(regEmail.trim());
      } else {
        toast("नवीन प्रशासक नोंदणी यशस्वी! स्वागत आहे.", "success");
      }
      setRegEmail("");
      setRegPw("");
      setRegPw2("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (/already registered|already exists/i.test(msg))
        setRegError("हा ईमेल आधीच नोंदवला आहे. प्रशासक टॅबमधून लॉगिन करा.");
      else setRegError(friendlyDbError(err));
    } finally {
      setRegBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-emerald-950 p-4 font-sans">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ y: [0, -34, 0], x: [0, 22, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-600/30 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 30, 0], x: [0, -26, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-24 -bottom-24 h-[28rem] w-[28rem] rounded-full bg-teal-500/25 blur-3xl"
        />
        <motion.div
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl"
        />
        <div className="dot-grid absolute inset-0 opacity-60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 34, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl"
      >
        {/* Card header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 px-6 pt-8 pb-6 text-center text-white">
          <div className="dot-grid pointer-events-none absolute inset-0" />
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.15 }}
            className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-900 shadow-xl ring-4 ring-amber-400"
          >
            <Syringe size={30} />
          </motion.div>
          <p className="relative text-[10px] font-bold tracking-[0.22em] text-amber-300 uppercase">
            सार्वजनिक आरोग्य विभाग
          </p>
          <h1 className="relative mt-1 text-2xl font-extrabold">लसीकरण ड्यू लिस्ट</h1>
          <p className="relative mt-1 text-xs text-emerald-200">
            {settings.phcName} PHC | {settings.subcenterName} उपकेंद्र
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <AnimatedTabs<LoginTab>
            namespace="login"
            active={tab}
            onChange={(t) => {
              setTab(t);
              setSelected(null);
              setPin("");
              setPinError("");
              setAdminError("");
              setRegError("");
            }}
            tabs={[
              { id: "ASHA", label: "आशा सेविका", icon: <UserIcon size={16} /> },
              { id: "ADMIN", label: "प्रशासक", icon: <ShieldCheck size={16} /> },
              { id: "REGISTER", label: "नवीन प्रशासक", icon: <UserPlus size={16} /> },
            ]}
          />

          <AnimatePresence mode="wait">
            {tab === "ASHA" ? (
              <motion.div
                key="asha"
                initial={{ opacity: 0, x: -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 18 }}
                transition={{ duration: 0.22 }}
                className="pt-5"
              >
                {!selected ? (
                  <>
                    <p className="mb-3 text-sm font-bold text-slate-600">
                      तुमचे नाव निवडा:
                    </p>
                    {loadingWorkers ? (
                      <div className="space-y-2.5">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="skeleton h-16 rounded-2xl" />
                        ))}
                      </div>
                    ) : workersError ? (
                      <div className="rounded-2xl bg-red-50 p-4 text-center ring-1 ring-red-200">
                        <p className="text-sm font-bold text-red-700">
                          यादी आणता आली नाही. इंटरनेट तपासा आणि पुन्हा प्रयत्न करा.
                        </p>
                        <button
                          onClick={() => setRetryTick((t) => t + 1)}
                          className="mt-3 rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow transition hover:bg-red-500 active:scale-95"
                        >
                          पुन्हा प्रयत्न करा
                        </button>
                      </div>
                    ) : workers.length === 0 ? (
                      <p className="rounded-2xl bg-amber-50 p-4 text-center text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
                        अद्याप कोणतीही आशा सेविका नोंदवली नाही. प्रशासक लॉगिन करून
                        आशा सेविका जोडा.
                      </p>
                    ) : (
                      <motion.div
                        variants={{
                          hidden: {},
                          show: { transition: { staggerChildren: 0.07 } },
                        }}
                        initial="hidden"
                        animate="show"
                        className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1"
                      >
                        {workers.map((w) => (
                          <motion.button
                            key={w.id}
                            variants={{
                              hidden: { opacity: 0, x: -22 },
                              show: { opacity: 1, x: 0 },
                            }}
                            whileHover={{ x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setSelected(w);
                              setPin("");
                              setPinError("");
                            }}
                            className="group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
                          >
                            <span className="flex items-center gap-3">
                              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-sm font-extrabold text-white shadow-md transition group-hover:bg-emerald-600">
                                {w.name.trim().charAt(0)}
                              </span>
                              <span className="font-bold text-slate-700 group-hover:text-emerald-900">
                                {w.name}
                              </span>
                            </span>
                            <ChevronRight
                              size={18}
                              className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-emerald-600"
                            />
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </>
                ) : (
                  <motion.div
                    key="pin"
                    initial={{ opacity: 0, x: 26 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22 }}
                  >
                    <button
                      onClick={() => {
                        setSelected(null);
                        setPin("");
                        setPinError("");
                      }}
                      className="mb-4 flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-emerald-700"
                    >
                      <ChevronLeft size={16} /> मागे जा
                    </button>
                    <div className="mb-5 text-center">
                      <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-700 text-xl font-extrabold text-white shadow-lg">
                        {selected.name.trim().charAt(0)}
                      </div>
                      <h2 className="text-lg font-extrabold text-slate-800">{selected.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        लॉगिनसाठी तुमचा ४ अंकी पिन टाका
                      </p>
                    </div>
                    <form onSubmit={submitPin} className="space-y-4">
                      <AnimatePresence>
                        {pinError && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden rounded-xl bg-red-50 text-center text-sm font-bold text-red-600 ring-1 ring-red-200"
                          >
                            <span className="block px-3 py-2">{pinError}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                      <motion.div
                        animate={shake > 0 ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
                        transition={{ duration: 0.4 }}
                        key={shake}
                        className="relative mx-auto max-w-[220px]"
                      >
                        <Lock
                          className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                          size={20}
                        />
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={4}
                          value={pin}
                          onChange={(e) => {
                            setPin(e.target.value.replace(/\D/g, ""));
                            setPinError("");
                          }}
                          placeholder="••••"
                          autoFocus
                          className="w-full rounded-2xl border-2 border-slate-200 py-3.5 pr-4 pl-12 text-center text-2xl font-extrabold tracking-[0.5em] text-slate-800 outline-none transition placeholder:text-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15"
                        />
                      </motion.div>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        disabled={pin.length !== 4}
                        className="w-full rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 py-3.5 font-extrabold text-white shadow-xl shadow-emerald-700/30 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
                      >
                        लॉगिन करा
                      </motion.button>
                    </form>
                  </motion.div>
                )}
              </motion.div>
            ) : tab === "ADMIN" ? (
              <motion.div
                key="admin"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
                className="pt-5"
              >
                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
                  <ShieldCheck size={22} className="shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed font-semibold text-amber-800">
                    फक्त आरोग्य सेवकांसाठी. तुमचा ईमेल व पासवर्ड टाका.
                  </p>
                </div>
                <form onSubmit={submitAdmin} className="space-y-4">
                  <AnimatePresence>
                    {adminError && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-xl bg-red-50 text-center text-sm font-bold text-red-600 ring-1 ring-red-200"
                      >
                        <span className="block px-3 py-2">{adminError}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ईमेल पत्ता"
                      autoComplete="username"
                      className="w-full rounded-2xl border border-slate-300 py-3 pr-4 pl-11 font-medium text-slate-800 outline-none transition placeholder:font-normal focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15"
                    />
                  </div>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type={showPw ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="पासवर्ड"
                      autoComplete="current-password"
                      className="w-full rounded-2xl border border-slate-300 py-3 pr-12 pl-11 font-medium text-slate-800 outline-none transition placeholder:font-normal focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                      aria-label={showPw ? "पासवर्ड लपवा" : "पासवर्ड दाखवा"}
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={adminBusy}
                    className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-3.5 font-extrabold text-emerald-950 shadow-xl shadow-amber-500/30 transition hover:brightness-105 disabled:opacity-50"
                  >
                    {adminBusy ? "तपासत आहे..." : "प्रशासक लॉगिन"}
                  </motion.button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22 }}
                className="pt-5"
              >
                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3.5 ring-1 ring-emerald-200">
                  <UserPlus size={22} className="shrink-0 text-emerald-700" />
                  <p className="text-xs leading-relaxed font-semibold text-emerald-800">
                    नवीन आरोग्य सेवक (प्रशासक) खाते तयार करा. हा ईमेल व पासवर्ड
                    लक्षात ठेवा — यानेच लॉगिन करायचे आहे.
                  </p>
                </div>
                <form onSubmit={submitRegister} className="space-y-4">
                  <AnimatePresence>
                    {regError && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-xl bg-red-50 text-center text-sm font-bold text-red-600 ring-1 ring-red-200"
                      >
                        <span className="block px-3 py-2">{regError}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="ईमेल पत्ता"
                      autoComplete="username"
                      className="w-full rounded-2xl border border-slate-300 py-3 pr-4 pl-11 font-medium text-slate-800 outline-none transition placeholder:font-normal focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15"
                    />
                  </div>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type={showRegPw ? "text" : "password"}
                      required
                      value={regPw}
                      onChange={(e) => setRegPw(e.target.value)}
                      placeholder="पासवर्ड (किमान ६ अक्षरे)"
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-slate-300 py-3 pr-12 pl-11 font-medium text-slate-800 outline-none transition placeholder:font-normal focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPw((s) => !s)}
                      className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                      aria-label={showRegPw ? "पासवर्ड लपवा" : "पासवर्ड दाखवा"}
                    >
                      {showRegPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute top-1/2 left-4 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type={showRegPw ? "text" : "password"}
                      required
                      value={regPw2}
                      onChange={(e) => setRegPw2(e.target.value)}
                      placeholder="पासवर्ड पुन्हा टाका"
                      autoComplete="new-password"
                      className="w-full rounded-2xl border border-slate-300 py-3 pr-4 pl-11 font-medium text-slate-800 outline-none transition placeholder:font-normal focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15"
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={regBusy}
                    className="w-full rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 py-3.5 font-extrabold text-white shadow-xl shadow-emerald-700/30 transition hover:brightness-110 disabled:opacity-50"
                  >
                    {regBusy ? "नोंदणी होत आहे..." : "प्रशासक खाते तयार करा"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-3.5 text-center">
          <p className="text-[11px] font-semibold text-slate-400">
            सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन
          </p>
        </div>
      </motion.div>
    </div>
  );
}
