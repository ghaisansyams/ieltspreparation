"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Flame,
  Gamepad2,
  GraduationCap,
  LayoutDashboard,
  Library,
  Menu,
  MessagesSquare,
  Monitor,
  Moon,
  Network,
  Plus,
  Repeat,
  Search,
  Settings,
  Sun,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd, Spinner } from "@/components/ui/misc";
import { ProgressRing } from "@/components/ui/progress";
import { useAppStore } from "@/lib/store/app-store";
import { useStats } from "@/lib/store/selectors";
import { useUiStore } from "@/lib/store/ui-store";
import { useTheme, type ThemePreference } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vocabulary", label: "My Vocabulary", icon: Library },
  { href: "/review", label: "Review", icon: Repeat, badge: "due" as const },
  { href: "/games", label: "Games", icon: Gamepad2 },
  { href: "/tutor", label: "AI Tutor", icon: MessagesSquare },
  { href: "/ielts", label: "IELTS Mode", icon: GraduationCap },
  { href: "/graph", label: "Word Graph", icon: Network },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Brand() {
  return (
    <Link href="/" className="group flex items-baseline gap-2 px-2">
      <span className="headword text-[26px] italic text-ink">Lexiband</span>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-3 transition-colors group-hover:text-ink-2">vocab hub</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const stats = useStats();
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(pathname, href);
        const count = badge === "due" ? stats.due : 0;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium transition-colors",
              active ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={active ? 2.2 : 1.8} />
            <span className="flex-1 truncate">{label}</span>
            {count > 0 ? (
              <span className="rounded-[4px] bg-accent px-1.5 py-px font-mono text-[10.5px] font-medium text-accent-contrast">{count > 99 ? "99+" : count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function ThemeSwitch() {
  const { preference, setTheme } = useTheme();
  const options: { value: ThemePreference; icon: typeof Sun; label: string }[] = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "system", icon: Monitor, label: "System" },
    { value: "dark", icon: Moon, label: "Dark" },
  ];
  return (
    <div className="inline-flex rounded-md border border-line bg-surface-2 p-0.5" role="radiogroup" aria-label="Theme">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn("grid size-7 place-items-center rounded-[5px] text-ink-3 transition-colors hover:text-ink", preference === value && "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]")}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

function SidebarFooter() {
  const stats = useStats();
  return (
    <div className="space-y-3 border-t border-line px-3 pb-3 pt-3">
      <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Level {stats.level}</span>
          <span className="font-mono text-[10.5px] text-ink-3">
            {stats.levelCurrent}/{stats.levelNext} XP
          </span>
        </div>
        <div className="mt-1 text-[13px] font-medium text-ink">{stats.levelTitle}</div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: `${stats.levelProgress * 100}%` }} />
        </div>
      </div>
      <ThemeSwitch />
    </div>
  );
}

function Topbar() {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);
  const stats = useStats();
  const name = useAppStore((s) => s.profile.displayName);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:gap-3 lg:px-8">
      <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
        <Menu />
      </Button>
      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm text-ink-3 transition-colors hover:border-line-strong sm:max-w-md"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate">Search vocabulary…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Button asChild variant="primary" size="sm" className="hidden sm:inline-flex">
          <Link href="/add">
            <Plus />
            Add Vocabulary
          </Link>
        </Button>
        <Button asChild variant="primary" size="icon-sm" className="sm:hidden" aria-label="Add vocabulary">
          <Link href="/add">
            <Plus />
          </Link>
        </Button>
        <div className="hidden items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 md:flex" title={`${stats.streak}-day streak`}>
          <Flame className={cn("size-4", stats.streak > 0 ? "text-series-2" : "text-ink-3")} />
          <span className="font-mono text-xs font-medium text-ink">{stats.streak}</span>
        </div>
        <Link href="/stats" className="hidden items-center gap-2 md:flex" title={`Level ${stats.level} · ${stats.xp} XP`}>
          <ProgressRing value={stats.levelProgress} size={32} stroke={2.5} label={`Level ${stats.level}`}>
            <span className="font-mono text-[10.5px] font-semibold text-ink">{stats.level}</span>
          </ProgressRing>
          <div className="hidden leading-tight xl:block">
            <div className="text-xs font-medium text-ink">{stats.levelTitle}</div>
            <div className="font-mono text-[10.5px] text-ink-3">{stats.xp.toLocaleString()} XP</div>
          </div>
        </Link>
        <Link
          href="/settings"
          className="grid size-8 place-items-center rounded-full border border-line-strong bg-surface-2 text-xs font-semibold uppercase text-ink-2 transition-colors hover:text-ink"
          aria-label="Profile and settings"
        >
          {name ? name.slice(0, 1) : "·"}
        </Link>
      </div>
    </header>
  );
}

function StorageWarning() {
  const mode = useUiStore((s) => s.storageMode);
  if (mode !== "memory") return null;
  return (
    <div role="alert" className="border-b border-bad/30 bg-bad-soft px-4 py-2.5 text-sm text-bad-ink lg:px-8">
      <strong className="font-semibold">This browser isn&rsquo;t saving your data.</strong> Storage is blocked (private window or strict privacy settings), so your library disappears when you close or reload the tab. Open the app in a normal window, or export a backup from Settings.
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useAppStore((s) => s.hydrated);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg lg:flex">
        <div className="flex h-14 items-center border-b border-line px-3">
          <Brand />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          <NavList />
        </div>
        <SidebarFooter />
      </aside>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent title="Navigation" hideTitle side="left" className="flex flex-col p-0">
          <div className="flex h-14 items-center border-b border-line px-3">
            <Brand />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">
            <NavList onNavigate={() => setMobileNavOpen(false)} />
          </div>
          <SidebarFooter />
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-col">
        <Topbar />
        <StorageWarning />
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          {hydrated ? (
            children
          ) : (
            <div className="flex h-[60vh] items-center justify-center gap-2 text-sm text-ink-3">
              <Spinner />
              Opening your library…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
