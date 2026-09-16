"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, ListFilter, LayoutDashboard, Zap, Play, ScanSearch, Network, Sun, Moon } from "lucide-react";
import type { Role } from "@/lib/types";

const ROLE_FRAMING: Record<Role, { label: string; tagline: string; cta: string }> = {
  investigator: {
    label: "Investigator",
    tagline: "Review submitted claims for overpayment and fraud.",
    cta: "Review queue",
  },
  provider: {
    label: "Provider",
    tagline: "Audit your own coding before it becomes a finding.",
    cta: "My compliance",
  },
  relator: {
    label: "Relator",
    tagline: "Report suspected fraud — recover 15–30% of findings.",
    cta: "My cases",
  },
};

export const ROLE_STORAGE_KEY = "fraudlens-role";
export const THEME_STORAGE_KEY = "fraudlens-theme";

export function getFraming(role: Role) {
  return ROLE_FRAMING[role];
}

const NAV = [
  { href: "/", label: "Case Queue", icon: ListFilter },
  { href: "/providers", label: "Providers", icon: LayoutDashboard },
  { href: "/tour", label: "Live Demos", icon: Zap },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/coding-demo", label: "Coding Demo", icon: ScanSearch },
  { href: "/demo", label: "Demo", icon: Play },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("investigator");
  // Theme: default "dark". The no-FOUC script in layout.tsx sets the initial
  // data-theme before paint; here we sync React state to it and toggle on click.
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // Sync to whatever the inline script already applied (avoids hydration mismatch).
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    setTheme(current);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore (private mode / disabled storage) */
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Top bar — frosted glass navbar */}
      <header
        className="sticky top-0 z-30 border-b border-[var(--border)]"
        style={{
          background: "var(--header-glass)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-5">
          <Link href="/" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{
                background: "var(--grad-1)",
                boxShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.18)",
              }}
            >
              <ShieldCheck className="h-4.5 w-4.5" strokeWidth={2.5} />
            </span>
            <span className="font-display text-[15px] font-extrabold tracking-tight text-[var(--foreground)]">
              Fraud
              <span
                style={{
                  background: "linear-gradient(135deg, #ffb59f, #a9c2ff)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Lens
              </span>
            </span>
            <span className="hidden rounded-md bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--accent-tint)] sm:inline">
              Corti Hack
            </span>
          </Link>

          <nav className="ml-4 flex items-center gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/" || pathname.startsWith("/case")
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all",
                    active
                      ? "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent-tint)]"
                      : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Role toggle + theme toggle */}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5">
              {(Object.keys(ROLE_FRAMING) as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-all",
                    role === r
                      ? "bg-[var(--accent-soft)] text-[var(--accent-tint)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  {ROLE_FRAMING[r].label}
                </button>
              ))}
            </div>
            <button
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6">{children}</main>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto w-full max-w-[1400px] px-5 py-3 text-xs text-[var(--muted-2)]">
          FraudLens · synthetic claims demo for Corti Hack for Health · not real clinical or billing data.
        </div>
      </footer>
    </div>
  );
}
