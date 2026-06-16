import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ChevronDown, Languages, Menu, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { relative } from "@/lib/format";
import { useAlerts, useDataSources } from "@/lib/api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SOURCE_STATUS, StatusDot } from "@/components/data-source";
import { ALERT_TONE } from "@/components/alert-row";

export function Topbar({
  onMenu,
  onAssistant,
  onCommand,
}: {
  onMenu: () => void;
  onAssistant: () => void;
  onCommand: () => void;
}) {
  const [lang, setLang] = useState<"en" | "bn">("en");

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bone/80 px-4 backdrop-blur-md sm:px-6">
      <button className="rounded-md p-2 text-ink-soft hover:bg-bone-2 lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </button>

      {/* command / search */}
      <button
        onClick={onCommand}
        className="group flex h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-line-strong bg-paper px-3 text-sm text-ink-ghost transition-colors hover:border-ink-ghost"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search or jump to anything…</span>
        <kbd className="hidden rounded border border-line bg-bone-2 px-1.5 font-mono text-[11px] text-ink-faint sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <DataSourceStatus />

        <button
          onClick={() => setLang((l) => (l === "en" ? "bn" : "en"))}
          className="hidden h-9 items-center gap-1.5 rounded-md border border-line-strong bg-paper px-2.5 text-sm text-ink-soft hover:border-ink-ghost sm:flex"
          title="Toggle language"
        >
          <Languages className="h-4 w-4" />
          <span className={cn(lang === "bn" && "bn")}>{lang === "en" ? "EN" : "বাংলা"}</span>
        </button>

        <Notifications />

        <Button variant="primary" size="sm" className="gap-1.5" onClick={onAssistant}>
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Ask AI</span>
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <button className="ml-1 flex items-center gap-1.5 rounded-md p-0.5 hover:bg-bone-2">
              <Avatar name="Tahmid Karim" tone="blue" size="sm" />
              <ChevronDown className="hidden h-4 w-4 text-ink-faint sm:block" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="px-1 pb-2">
              <div className="text-sm font-medium text-ink">Tahmid Karim</div>
              <div className="text-xs text-ink-faint">Owner / Principal</div>
            </div>
            <div className="border-t border-line pt-2 text-sm text-ink-soft">
              <button className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-bone-2">Profile & preferences</button>
              <button className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-bone-2">Switch role view</button>
              <button className="block w-full rounded-md px-2 py-1.5 text-left text-rust hover:bg-rust-tint">Sign out</button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

function DataSourceStatus() {
  const { data: sources = [] } = useDataSources();
  const connected = sources.filter((s) => s.status === "connected" || s.status === "syncing").length;
  const issues = sources.filter((s) => s.status === "stale" || s.status === "error").length;
  const active = sources.filter((s) => s.status !== "not_connected");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex h-9 items-center gap-2 rounded-md border border-line-strong bg-paper px-2.5 text-sm text-ink-soft hover:border-ink-ghost">
          <span className="relative flex h-2 w-2">
            <span className={cn("absolute inline-flex h-full w-full rounded-full", issues ? "bg-ochre" : "bg-sage")} />
          </span>
          <span className="hidden tnum sm:inline">{connected} live</span>
          {issues > 0 && <span className="text-ochre tnum">· {issues} stale</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="mb-2 flex items-center justify-between">
          <span className="label-draft">Connected sources</span>
          <span className="text-xs text-ink-faint">{active.length} of {sources.length}</span>
        </div>
        <ul className="max-h-80 space-y-0.5 overflow-y-auto">
          {active.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-bone-2">
              <div className="flex items-center gap-2">
                <StatusDot status={s.status} pulse />
                <span className="text-sm text-ink">{s.name}</span>
              </div>
              <span className={cn("text-[11px]", SOURCE_STATUS[s.status].text)}>
                {s.lastSync ? relative(s.lastSync) : SOURCE_STATUS[s.status].label}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function Notifications() {
  const { data: alerts = [] } = useAlerts();
  const unread = alerts.filter((a) => !a.acknowledged).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line-strong bg-paper text-ink-soft hover:border-ink-ghost">
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rust px-1 text-[10px] font-medium text-paper tnum">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="label-draft">Alerts</span>
          <span className="text-xs text-ink-faint">{unread} new</span>
        </div>
        <ul className="max-h-96 divide-y divide-line overflow-y-auto">
          {alerts.slice(0, 6).map((a) => (
            <li key={a.id} className="flex gap-3 px-4 py-3 hover:bg-paper-2">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", ALERT_TONE[a.severity].dot)} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{a.title}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{a.detail}</div>
                <div className="mt-1 text-[11px] text-ink-ghost">{relative(a.createdAt)} · {a.category}</div>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
