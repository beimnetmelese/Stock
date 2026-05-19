import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  BadgePercent,
  Box,
  CheckCircle2,
  ChevronDown,
  Edit3,
  Filter,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MoonStar,
  MoreVertical,
  Plus,
  ReceiptText,
  Search,
  Store,
  SunMedium,
  Trash2,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";
import {
  BrowserRouter as Router,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import {
  dateRangeOptions,
  type CartItem,
  type DateRangeKey,
  type Product,
} from "./data/mockData";
import { BackendProvider, useBackendData } from "./lib/backend";
import {
  clearAuthSession,
  getAuthSession,
  restoreAuthSession,
  signInWithSupabase,
  signOutFromSupabase,
} from "./lib/supabase";
import { cn } from "./lib/utils";

const svgImage = (label: string, color: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="34" fill="url(#g)" />
      <circle cx="122" cy="42" r="20" fill="rgba(255,255,255,0.16)" />
      <text x="50%" y="54%" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="36" font-weight="700" fill="white">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

type ThemeMode = "light" | "dark";
type AuthSubmitResult = {
  status: "authenticated" | "confirmation" | "error";
  message: string;
};

const themeKey = "stock-theme";
const currencyFormatter = new Intl.NumberFormat("en-US");

const navItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Products", path: "/products", icon: Box },
  { label: "Inventory", path: "/inventory", icon: Warehouse },
  { label: "Sales", path: "/sales", icon: ReceiptText },
  { label: "Sales History", path: "/sales-history", icon: History },
  { label: "Analytics", path: "/analytics", icon: TrendingUp },
];

const getProductImage = (name: string): string => {
  const colors = [
    "#ea580c",
    "#0891b2",
    "#059669",
    "#7c3aed",
    "#dc2626",
    "#f59e0b",
    "#06b6d4",
    "#10b981",
  ];
  const label = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = colors[hash % colors.length];
  return svgImage(label, color);
};

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 dark:bg-slate-900/60">
      <div className="flex items-center gap-4 rounded-2xl bg-white/90 p-6 shadow-lg dark:bg-slate-900/80">
        <svg
          className="h-10 w-10 animate-spin text-sky-500"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <div>
          <div className="font-medium text-slate-900 dark:text-white">
            Loading data from Supabase
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            Fetching products, inventory and sales...
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      if (typeof window === "undefined") return "light" as ThemeMode;
      return (window.localStorage.getItem(themeKey) as ThemeMode) ?? "light";
    } catch {
      return "light" as ThemeMode;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(themeKey, theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    const initializeAuth = async () => {
      const session = await restoreAuthSession();

      if (!cancelled) {
        setIsAuthenticated(Boolean(session));
        setAuthReady(true);
      }
    };

    void initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;

    const checkSession = () => {
      try {
        const s = getAuthSession();
        if (!s) {
          clearAuthSession();
          setIsAuthenticated(false);
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
          return;
        }

        if (s.expiresAt && Date.now() > s.expiresAt) {
          clearAuthSession();
          setIsAuthenticated(false);
          if (window.location.pathname !== "/login") {
            window.location.href = "/login";
          }
        }
      } catch {
        // ignore
      }
    };

    checkSession();
    const id = window.setInterval(checkSession, 30 * 1000);

    return () => window.clearInterval(id);
  }, [authReady]);

  const handleAuthSubmit = async ({
    email,
    password,
    rememberMe,
  }: {
    email: string;
    password: string;
    rememberMe: boolean;
  }): Promise<AuthSubmitResult> => {
    try {
      await signInWithSupabase({ email, password, rememberMe });
      setIsAuthenticated(true);
      return {
        status: "authenticated",
        message: "Signed in with Supabase.",
      };
    } catch (error) {
      setIsAuthenticated(false);
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Supabase authentication failed.",
      };
    }
  };

  const handleLogout = async () => {
    await signOutFromSupabase();
    clearAuthSession();
    setIsAuthenticated(false);
  };

  const setTheme = (nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
  };

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        Checking Supabase session...
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <BackendProvider>
        <Router>
          <Routes>
            <Route
              path="/login"
              element={
                isAuthenticated ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <LoginPage
                    theme={theme}
                    setTheme={setTheme}
                    onAuthSubmit={handleAuthSubmit}
                  />
                )
              }
            />
            <Route
              element={
                isAuthenticated ? (
                  <DashboardLayout
                    theme={theme}
                    setTheme={setTheme}
                    onLogout={handleLogout}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/sales-history" element={<SalesHistoryPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Route>
          </Routes>
        </Router>
      </BackendProvider>
    </ErrorBoundary>
  );
}

class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; message?: string }
> {
  state: { hasError: boolean; message?: string } = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-rose-700 shadow">
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm">
              An unexpected error occurred while rendering the app:{" "}
              {this.state.message}
            </p>
            <div className="mt-4">
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-white"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function LoginPage({
  theme,
  setTheme,
  onAuthSubmit,
}: {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  onAuthSubmit: (input: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => Promise<AuthSubmitResult>;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<
    "error" | "success" | "info" | null
  >(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    setStatusTone(null);

    const result = await onAuthSubmit({
      email,
      password,
      rememberMe,
    });

    setIsSubmitting(false);
    setStatusMessage(result.message);

    if (result.status === "error") {
      setStatusTone("error");
      return;
    }

    setStatusTone("success");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div
        className={cn(
          "absolute inset-0",
          theme === "dark"
            ? "bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.24),_transparent_30%),radial-gradient(circle_at_75%_20%,_rgba(34,197,94,0.2),_transparent_24%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.95))]"
            : "bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_35%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.16),_transparent_28%),linear-gradient(135deg,_rgba(241,245,249,1),_rgba(226,232,240,0.9))]",
        )}
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20 dark:opacity-20" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/70 shadow-soft backdrop-blur-xl dark:border-slate-700/70 dark:bg-slate-900/70 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="hidden flex-col justify-between p-10 lg:flex">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
                <Store className="h-4 w-4 text-sky-500 dark:text-sky-300" />
                Stock Management ERP
              </div>
              <div className="space-y-4">
                <h1 className="max-w-xl text-5xl font-semibold leading-tight text-slate-900 dark:text-white">
                  Manage stock, sales, profit, and inventory flow from one
                  elegant workspace.
                </h1>
                <p className="max-w-lg text-base leading-7 text-slate-600 dark:text-slate-300">
                  Track products, register sales, and keep stock in sync with a
                  clean dashboard built for daily operations.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8 sm:p-10">
            <div className="mx-auto max-w-md">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.3em] text-sky-500 dark:text-sky-300">
                    StockMangemnet
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
                    Sign in with Supabase
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="rounded-2xl border border-slate-200 p-3 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {theme === "dark" ? (
                    <SunMedium className="h-5 w-5" />
                  ) : (
                    <MoonStar className="h-5 w-5" />
                  )}
                </button>
              </div>

              {statusMessage ? (
                <div
                  className={cn(
                    "mb-4 rounded-2xl border px-4 py-3 text-sm",
                    statusTone === "error" &&
                      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
                    statusTone === "success" &&
                      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
                    statusTone === "info" &&
                      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200",
                  )}
                >
                  {statusMessage}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Email
                  </span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    placeholder="name@company.com"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Password
                  </span>
                  <div className="relative">
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-14 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-sky-500"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                  />
                  Remember me
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 text-sm font-medium text-white shadow-md shadow-sky-500/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  {isSubmitting ? "Working..." : "Enter dashboard"}
                </button>
              </form>

              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Use your Supabase Auth credentials to sign in.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardLayout({
  theme,
  setTheme,
  onLogout,
}: {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  onLogout: () => void;
}) {
  const { isLoading } = useBackendData();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const location = useLocation();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);

    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const pageLabel = useMemo(() => {
    const matched = navItems.find((item) =>
      location.pathname.startsWith(item.path),
    );
    return matched?.label ?? "Dashboard";
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {isLoading ? <LoadingOverlay /> : null}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.1),_transparent_30%),radial-gradient(circle_at_80%_0%,_rgba(16,185,129,0.09),_transparent_25%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_30%),radial-gradient(circle_at_80%_0%,_rgba(16,185,129,0.12),_transparent_25%)]" />

      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200/70 bg-white/80 px-4 py-5 backdrop-blur-xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-950/80 lg:translate-x-0 lg:static lg:block",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-2">
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-400 text-white shadow-lg shadow-sky-500/20">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-500 dark:text-sky-300">
                    StockMangemnet
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    ERP Dashboard
                  </div>
                </div>
              </Link>
              <button
                type="button"
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900 lg:hidden"
                onClick={() => setMobileSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-8 flex-1 space-y-2 overflow-y-auto pr-1">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                        isActive
                          ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white",
                      )
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        </aside>

        {mobileSidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close mobile sidebar overlay"
          />
        ) : null}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 lg:hidden"
                  onClick={() => setMobileSidebarOpen(true)}
                  aria-label="Open sidebar"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Operational workspace
                  </div>
                  <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {pageLabel}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  {theme === "dark" ? (
                    <SunMedium className="h-5 w-5" />
                  ) : (
                    <MoonStar className="h-5 w-5" />
                  )}
                </button>

                <div ref={profileRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileMenuOpen((value) => !value)}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-400 text-sm font-semibold text-white">
                      AM
                    </div>
                    <div className="hidden text-left sm:block">
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        Admin Manager
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Head Office
                      </div>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>

                  {profileMenuOpen ? (
                    <div className="absolute right-0 mt-3 w-56 rounded-3xl border border-slate-200 bg-white p-2 shadow-soft dark:border-slate-800 dark:bg-slate-900">
                      {[{ label: "Logout", icon: LogOut }].map((item) => {
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setProfileMenuOpen(false);
                              if (item.label === "Logout") {
                                onLogout();
                              }
                            }}
                            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Icon className="h-4 w-4" />
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <Outlet context={{ theme, setTheme, onLogout }} />
          </main>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const {
    dashboardMetricsByRange,
    salesOverviewByRange,
    bestSellingProducts,
    monthlyRevenue,
    recentSales,
    lowStockAlerts,
  } = useBackendData();
  const [dateRange, setDateRange] = useState<DateRangeKey>("30d");
  const [customStart, setCustomStart] = useState("2026-05-01");
  const [customEnd, setCustomEnd] = useState("2026-05-30");

  const metrics = dashboardMetricsByRange[dateRange];
  const salesData = salesOverviewByRange[dateRange];

  const salesKpiByRange: Record<
    DateRangeKey,
    { title: string; delta: string }
  > = {
    today: { title: "Daily Sales", delta: "Orders processed today" },
    "7d": { title: "Weekly Sales", delta: "Orders processed in 7 days" },
    "30d": { title: "Monthly Sales", delta: "Orders processed in 30 days" },
    "1y": { title: "Yearly Sales", delta: "Orders processed in 1 year" },
    custom: { title: "Period Sales", delta: "Orders in selected date range" },
  };

  const salesKpi = salesKpiByRange[dateRange];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Dashboard overview
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            ERP-grade visibility across sales, profit, and inventory health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {dateRangeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setDateRange(option.key)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition",
                dateRange === option.key
                  ? "bg-sky-500 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {dateRange === "custom" ? (
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:w-fit">
          <Field
            label="Start Date"
            value={customStart}
            onChange={setCustomStart}
            type="date"
          />
          <Field
            label="End Date"
            value={customEnd}
            onChange={setCustomEnd}
            type="date"
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total Revenue"
          value={formatBirr(metrics.revenue as number)}
          delta="+18.2% vs last period"
          icon={TrendingUp}
          accent="from-sky-500 to-cyan-400"
        />
        <StatCard
          title="Total Profit"
          value={formatBirr(metrics.profit as number)}
          delta="+11.4% vs last period"
          icon={BadgePercent}
          accent="from-emerald-500 to-teal-400"
        />
        <StatCard
          title="Inventory Value"
          value={formatBirr(metrics.inventoryValue as number)}
          delta="Recalculated from inventory batches"
          icon={Warehouse}
          accent="from-violet-500 to-fuchsia-400"
        />
        <StatCard
          title="Total Products"
          value={currencyFormatter.format(metrics.totalProducts as number)}
          delta="Catalog items actively tracked"
          icon={Box}
          accent="from-orange-500 to-amber-400"
        />
        <StatCard
          title="Low Stock Products"
          value={currencyFormatter.format(metrics.lowStockProducts as number)}
          delta="Attention needed in replenishment"
          icon={Filter}
          accent="from-rose-500 to-pink-400"
        />
        <StatCard
          title={salesKpi.title}
          value={String(metrics.dailySales as number)}
          delta={salesKpi.delta}
          icon={ReceiptText}
          accent="from-cyan-500 to-sky-400"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Sales overview"
          description="Orders and profit trend across the selected range."
        >
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="label"
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "currentColor", fontSize: 12 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#38bdf8"
                fill="url(#salesFill)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Profit trend"
          description="Profit remains healthy as restocking improves turnover."
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="label"
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "currentColor", fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#22c55e"
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Best-selling products"
          description="Top movers by orders and demand intensity."
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={bestSellingProducts}
              layout="vertical"
              margin={{ left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                type="number"
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <Tooltip />
              <Bar dataKey="orders" fill="#0ea5e9" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Monthly revenue"
          description="A year-long view of revenue growth and seasonality."
        >
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="month"
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "currentColor", fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#8b5cf6"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Recent sales">
          <div className="space-y-3">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {sale.id}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {sale.customer} · {sale.items} items
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {formatBirr(sale.amount)}
                  </div>
                  <Badge
                    tone={sale.status === "Completed" ? "success" : "warning"}
                  >
                    {sale.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Top selling products">
          <div className="space-y-3">
            {bestSellingProducts.map((product, index) => (
              <div
                key={product.name}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      #{index + 1} {product.name}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {product.orders} orders
                    </div>
                  </div>
                  <Badge tone="info">{product.margin}% margin</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Low stock alerts">
          <div className="space-y-3">
            {lowStockAlerts.map((alert) => (
              <div
                key={alert.name}
                className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/30 dark:bg-rose-950/25 dark:text-rose-100"
              >
                <div className="font-medium">{alert.name}</div>
                <div className="text-sm opacity-90">
                  Current stock {alert.stock} vs limit {alert.limit}. Reorder
                  before stock depletes.
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ProductsPage() {
  const { products, saveProduct, deleteProduct } = useBackendData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [stockStatus, setStockStatus] = useState<
    "All" | "In Stock" | "Low Stock" | "Out of Stock"
  >("All");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categories = [
    "All",
    ...new Set(products.map((product) => product.category)),
  ];

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      String(product.name ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      String(product.sku ?? "")
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchesCategory = category === "All" || product.category === category;
    const matchesStockStatus =
      stockStatus === "All" || product.status === stockStatus;
    return matchesSearch && matchesCategory && matchesStockStatus;
  });

  const openEdit = (product: Product) => {
    setSelectedProduct(product);
    setIsEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Products management
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Catalog, search, pricing, and lifecycle actions for the mock ERP.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-sm font-medium text-white shadow-md shadow-sky-500/20 transition hover:-translate-y-0.5 hover:bg-sky-400"
        >
          <Plus className="h-4 w-4" /> Add product
        </button>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product name or SKU"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition",
                category === item
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 md:col-span-2">
          {["All", "In Stock", "Low Stock", "Out of Stock"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStockStatus(item as typeof stockStatus)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition",
                stockStatus === item
                  ? "bg-rose-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/60">
              <tr>
                {[
                  "Product image",
                  "Product name",
                  "SKU",
                  "Category",
                  "Current stock",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="transition hover:bg-slate-50 dark:hover:bg-slate-950/70"
                >
                  <td className="px-4 py-4">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-14 w-14 rounded-2xl object-cover shadow-sm"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {product.name}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {product.description}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {product.sku}
                  </td>
                  <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {product.category}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-slate-900 dark:text-white">
                    {product.stock}
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={statusTone(product.status)}>
                      {product.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative inline-flex items-center gap-2">
                      <button
                        onClick={() => openEdit(product)}
                        type="button"
                        className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setIsDeleteOpen(true);
                        }}
                        type="button"
                        className="rounded-xl border border-slate-200 p-2 text-rose-500 transition hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={isDeleteOpen}
        title="Delete product"
        description={
          selectedProduct
            ? `Remove ${selectedProduct.name} from the catalog?`
            : "Remove this product from the catalog?"
        }
        confirmLabel="Delete"
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={async () => {
          if (selectedProduct) {
            await deleteProduct(selectedProduct.id);
          }
          setIsDeleteOpen(false);
        }}
      />
      <ProductModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        mode="Add"
        onSave={saveProduct}
      />
      <ProductModal
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        mode="Edit"
        product={selectedProduct}
        onSave={saveProduct}
      />
    </div>
  );
}

function InventoryPage() {
  const { inventoryBatches, addInventoryBatch } = useBackendData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Inventory management
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track stock entries with clear batch quantities, costs, and dates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white shadow-md shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" /> Add stock purchase
        </button>
      </div>

      <Panel title="Inventory batches">
        <p className="max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          Each purchase is recorded as its own batch so you can quickly review
          received quantity, unit cost, remaining stock, and purchase date.
        </p>
      </Panel>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-950/60">
            <tr>
              {[
                "Product",
                "Batch quantity",
                "Unit cost",
                "Remaining stock",
                "Purchase date",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {inventoryBatches.map((batch) => (
              <tr
                key={batch.id}
                className="transition hover:bg-slate-50 dark:hover:bg-slate-950/70"
              >
                <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                  {batch.product_name}
                </td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                  {batch.quantity}
                </td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                  {formatBirr(batch.unit_cost)}
                </td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                  {batch.remaining_stock}
                </td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                  {batch.purchase_date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <StockModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={addInventoryBatch}
      />
    </div>
  );
}

function SalesPage() {
  const { salesCatalog, products, registerSale } = useBackendData();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const filteredCatalog = salesCatalog.filter((product) =>
    String(product.name ?? "")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  const updateQuantity = (id: number, quantity: number) => {
    setCart((current) =>
      current.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  };

  const updatePrice = (id: number, price: number) => {
    setCart((current) =>
      current.map((item) =>
        item.id === id ? { ...item, price: Math.max(0, price) } : item,
      ),
    );
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const grossAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const netAmount = grossAmount;
  const estimatedProfit = netAmount * 0.28;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Point of sale
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Fast product lookup, cart building, and total calculation for a
            stock-centric sales workflow.
          </p>
        </div>

        <Panel title="Add products to cart">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product catalog"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950"
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCatalog.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() =>
                  setCart((current) => {
                    const existing = current.find(
                      (item) => item.id === product.id,
                    );
                    if (existing) {
                      return current.map((item) =>
                        item.id === product.id
                          ? { ...item, quantity: item.quantity + 1 }
                          : item,
                      );
                    }

                    return [
                      ...current,
                      {
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        quantity: 1,
                      },
                    ];
                  })
                }
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-14 w-14 rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900 dark:text-white">
                    {product.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Stock: {product.stock}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {formatBirr(product.price)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    List price
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Current cart">
          <div className="space-y-3">
            {cart.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {item.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Unit price {formatBirr(item.price)}
                  </div>
                </div>
                <Field
                  label="Qty"
                  value={String(item.quantity)}
                  onChange={(value) => updateQuantity(item.id, Number(value))}
                  type="number"
                  compact
                />
                <Field
                  label="Price"
                  value={String(item.price)}
                  onChange={(value) => updatePrice(item.id, Number(value))}
                  type="number"
                  compact
                />
                <button
                  type="button"
                  onClick={() =>
                    setCart((current) =>
                      current.filter((entry) => entry.id !== item.id),
                    )
                  }
                  className="rounded-xl border border-rose-200 px-3 py-2 text-rose-600 transition hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-6">
        <Panel title="Sale summary">
          <div className="space-y-4">
            <SummaryLine
              label="Total items"
              value={currencyFormatter.format(totalItems)}
            />
            <SummaryLine label="Total amount" value={formatBirr(grossAmount)} />
            <SummaryLine
              label="Net total"
              value={formatBirr(netAmount)}
              emphasized
            />
            <SummaryLine
              label="Estimated profit"
              value={formatBirr(estimatedProfit)}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Payment method
              </label>
              <select
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950"
              >
                {["Cash", "Card", "Mobile Money", "Bank Transfer"].map(
                  (method) => (
                    <option key={method}>{method}</option>
                  ),
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={async () => {
                await registerSale({
                  customer: "Walk-in Customer",
                  paymentMethod: paymentMethod as
                    | "Cash"
                    | "Card"
                    | "Mobile Money"
                    | "Bank Transfer",
                  items: cart.map((item) => {
                    const match = products.find(
                      (product) => product.id === item.id,
                    );
                    return {
                      productId: item.id,
                      productName: item.name,
                      quantity: item.quantity,
                      price: item.price,
                      cost: match?.cost ?? 0,
                    };
                  }),
                });
                setCart([]);
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 px-4 py-3 text-sm font-medium text-white shadow-md shadow-emerald-500/20 transition hover:-translate-y-0.5"
            >
              <CheckCircle2 className="h-4 w-4" /> Complete sale
            </button>

            <Link
              to="/sales-history"
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              View sales history
            </Link>
          </div>
        </Panel>

        <Panel title="Sale details">
          <div className="grid gap-3 text-sm text-slate-600 dark:text-slate-300">
            <SummaryLine label="Payment method" value={paymentMethod} />
            <SummaryLine
              label="Cart items"
              value={`${cart.length} product lines`}
            />
            <SummaryLine
              label="Stock note"
              value="Inventory and sales update from current stock batches."
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AnalyticsPage() {
  const { analyticsRevenue, inventoryMovement, analyticsTables } =
    useBackendData();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Analytics
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Advanced performance views for merchandising, margin, and inventory
          movement.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Revenue and profit trends"
          description="Wide view of how earnings move over time."
        >
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsRevenue}>
              <defs>
                <linearGradient
                  id="analyticsRevenueFill"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="label"
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "currentColor", fontSize: 12 }} />
              <Tooltip />
              <Area
                dataKey="revenue"
                stroke="#8b5cf6"
                fill="url(#analyticsRevenueFill)"
                strokeWidth={3}
              />
              <Line
                dataKey="profit"
                stroke="#22c55e"
                strokeWidth={3}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Margin analysis"
          description="Profit margin by reporting window."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsRevenue}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="label"
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "currentColor", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="margin" fill="#0ea5e9" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Best sellers and slow movers"
          description="Balanced inventory performance snapshot."
        >
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={[
                  { name: "Best sellers", value: 62 },
                  { name: "Slow movers", value: 18 },
                  { name: "Neutral", value: 20 },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={108}
                paddingAngle={3}
              >
                {["#38bdf8", "#fb7185", "#a78bfa"].map((color) => (
                  <Cell key={color} fill={color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Inventory movement"
          description="Batches received, sold, and adjusted."
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={inventoryMovement}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis
                dataKey="label"
                tick={{ fill: "currentColor", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "currentColor", fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#14b8a6" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Best selling products">
          <AnalyticsTable
            rows={analyticsTables.bestSelling}
            columns={["name", "units", "revenue", "margin"]}
          />
        </Panel>
        <Panel title="Most profitable products">
          <AnalyticsTable
            rows={analyticsTables.mostProfitable}
            columns={["name", "profit", "revenue", "margin"]}
          />
        </Panel>
        <Panel title="Slow moving products">
          <AnalyticsTable
            rows={analyticsTables.slowMoving}
            columns={["name", "days", "stock", "turnover"]}
          />
        </Panel>
      </div>
    </div>
  );
}

function SalesHistoryPage() {
  const { saleItems = [], salesHistory = [] } = useBackendData();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "All" | "Completed" | "Pending" | "Refunded"
  >("All");

  // combine sale item with sale info
  const enriched = saleItems.map((item) => {
    const sale = salesHistory.find(
      (s) => String(s?.id) === String(item?.sale_id),
    );

    return {
      ...item,

      // use camelCase because your frontend types use camelCase
      saleDate: sale?.date || "N/A",
      paymentMethod: sale?.paymentMethod || "N/A",
      saleStatus: sale?.status || "Pending",

      // fallback until product join exists
      productName: item?.product_name || `Product #${item?.product_id}`,
    };
  });

  // filtering
  const filtered = enriched.filter((row) => {
    const searchText = String(search || "").toLowerCase();

    const productName = String(row?.productName || "").toLowerCase();

    const saleId = String(row?.sale_id || "").toLowerCase();

    const matchesSearch =
      productName.includes(searchText) || saleId.includes(searchText);

    const matchesStatus =
      statusFilter === "All" || String(row?.saleStatus || "") === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
          Sales History
        </h2>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Itemized sales including quantity, price, payment method, and date.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[1fr_auto] md:items-center">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product or sale ID"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {["All", "Completed", "Pending", "Refunded"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatusFilter(item as typeof statusFilter)}
              className={cn(
                "rounded-xl px-3 py-2 text-sm font-medium transition",
                statusFilter === item
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            {/* Head */}
            <thead className="bg-slate-50 dark:bg-slate-950/60">
              <tr>
                {[
                  "Product",
                  "Quantity",
                  "Unit Price",
                  "Total",
                  "Date",
                  "Payment",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.length > 0 ? (
                filtered.map((row) => (
                  <tr
                    key={`${row.sale_id}-${row.id}`}
                    className="transition hover:bg-slate-50 dark:hover:bg-slate-950/70"
                  >
                    {/* Product */}
                    <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                      {row.productName}
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {row.quantity ?? 0}
                    </td>

                    {/* Unit Price */}
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {formatBirr(Number(row.price ?? 0))}
                    </td>

                    {/* Total */}
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {formatBirr(
                        Number(
                          row.total ??
                            Number(row.price ?? 0) * Number(row.quantity ?? 0),
                        ),
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {row.saleDate}
                    </td>

                    {/* Payment */}
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                      {row.paymentMethod}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No sales history found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AnalyticsTable({
  rows,
  columns,
}: {
  rows: Array<Record<string, string | number>>;
  columns: string[];
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div
          key={index}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="font-medium text-slate-900 dark:text-white">
            {row.name as string}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-500 dark:text-slate-400">
            {columns
              .filter((column) => column !== "name")
              .map((column) => (
                <div
                  key={column}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-slate-900"
                >
                  <span className="capitalize">{column}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {String(row[column])}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProductModal({
  open,
  onClose,
  mode,
  product,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  mode: "Add" | "Edit";
  product?: Product | null;
  onSave: (
    product: Partial<Product> & { image?: string },
  ) => Promise<void> | void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    category: product?.category ?? "Groceries",
    description: product?.description ?? "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: product?.name ?? "",
        sku: product?.sku ?? "",
        category: product?.category ?? "Groceries",
        description: product?.description ?? "",
      });
    }
  }, [open, product]);

  const imagePreview =
    form.name.trim() !== "" ? getProductImage(form.name) : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${mode} product`}
      subtitle="Save product details into the catalog."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Product name"
          value={form.name}
          onChange={(value) =>
            setForm((current) => ({ ...current, name: value }))
          }
        />
        <Field
          label="SKU"
          value={form.sku}
          onChange={(value) =>
            setForm((current) => ({ ...current, sku: value }))
          }
        />
        <Field
          label="Category"
          type="select"
          value={form.category}
          onChange={(value) =>
            setForm((current) => ({ ...current, category: value }))
          }
          options={["Groceries", "Household", "Beverages", "Stationery"]}
        />
        {imagePreview ? (
          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Product image preview
            </span>
            <img
              src={imagePreview}
              alt="Product preview"
              className="h-24 w-24 rounded-2xl object-cover"
            />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Auto-generated from product name
            </div>
          </div>
        ) : null}
        <div className="md:col-span-2">
          <Field
            label="Description"
            value={form.description}
            onChange={(value) =>
              setForm((current) => ({ ...current, description: value }))
            }
            textarea
          />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={async () => {
            await onSave({
              id: product?.id,
              name: form.name,
              sku: form.sku,
              category: form.category,
              description: form.description,
              image: imagePreview,
            });
            onClose();
          }}
          className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-sky-400"
        >
          Save product
        </button>
      </div>
    </Modal>
  );
}

function StockModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (batch: {
    productId: number;
    productName: string;
    quantity: number;
    unitCost: number;
    supplier: string;
    purchaseDate: string;
  }) => Promise<void> | void;
}) {
  const { products } = useBackendData();
  const [productName, setProductName] = useState(products[0]?.name ?? "");
  const [quantity, setQuantity] = useState("120");
  const [unitCost, setUnitCost] = useState("305");
  const [supplier, setSupplier] = useState("Prime Supplies PLC");
  const [purchaseDate, setPurchaseDate] = useState("2026-05-18");

  useEffect(() => {
    if (open) {
      setProductName(products[0]?.name ?? "");
      setQuantity("120");
      setUnitCost("305");
      setSupplier("Prime Supplies PLC");
      setPurchaseDate("2026-05-18");
    }
  }, [open, products]);

  const selectedProduct = products.find(
    (product) => product.name === productName,
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add stock purchase"
      subtitle="Track new inventory batches across purchases."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Product selector"
          type="select"
          value={productName}
          onChange={setProductName}
          options={products.map((product) => product.name)}
        />
        <Field label="Quantity" value={quantity} onChange={setQuantity} />
        <Field label="Unit cost" value={unitCost} onChange={setUnitCost} />
        <Field label="Supplier" value={supplier} onChange={setSupplier} />
        <Field
          label="Purchase date"
          type="date"
          value={purchaseDate}
          onChange={setPurchaseDate}
        />
      </div>
      <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-100">
        Batch tracking keeps inventory quantities, costs, and purchase history
        easy to review.
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!selectedProduct) {
              onClose();
              return;
            }

            await onSave({
              productId: selectedProduct.id,
              productName: selectedProduct.name,
              quantity: Number(quantity),
              unitCost: Number(unitCost),
              supplier,
              purchaseDate,
            });
            onClose();
          }}
          className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-400"
        >
          Save stock purchase
        </button>
      </div>
    </Modal>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} subtitle={description}>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-rose-400"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function StatCard({
  title,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  delta: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {value}
          </div>
        </div>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
            accent,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <ArrowUpRight className="h-4 w-4" />
        {delta}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "warning" | "danger" | "info";
}) {
  const classes = {
    success:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    warning:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    danger: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
        classes[tone],
      )}
    >
      {children}
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  textarea,
  readOnly,
  compact,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date" | "select";
  options?: string[];
  textarea?: boolean;
  readOnly?: boolean;
  compact?: boolean;
}) {
  return (
    <label className={cn("space-y-2", compact ? "block" : "block")}>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {type === "select" ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={readOnly}
          className={cn(
            "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950",
            compact ? "h-11" : "h-12",
          )}
        >
          {options?.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          type={type}
          className={cn(
            "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 dark:border-slate-800 dark:bg-slate-950",
            compact ? "h-11" : "h-12",
          )}
        />
      )}
    </label>
  );
}

function SummaryLine({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950",
        emphasized &&
          "border-sky-200 bg-sky-50 dark:border-sky-900/30 dark:bg-sky-950/20",
      )}
    >
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold text-slate-900 dark:text-white",
          emphasized && "text-sky-700 dark:text-sky-300",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function statusTone(status: Product["status"]) {
  if (status === "In Stock") {
    return "success";
  }

  if (status === "Low Stock") {
    return "warning";
  }

  return "danger";
}

function formatBirr(value: number) {
  return `Br ${currencyFormatter.format(Number.isFinite(value) ? value : 0)}`;
}

export default App;
