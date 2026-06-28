import { Link } from "react-router-dom";
import { Bell, ChevronDown, Menu, Plus, Radar, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { relative } from "@/lib/format";
import { useAiActivity, useAiApprovals, useAiPayments } from "@/lib/archintel/api";
import { useAuth } from "@/lib/auth";
import { AUTH_ENABLED } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function Topbar({ onMenu, onCommand, onAssistant }: { onMenu: () => void; onCommand: () => void; onAssistant: () => void }) {
  // useAuth() returns the hardcoded "Fariha Karim / FK" default when the flag
  // is OFF (provider not mounted) → off-path render is byte-identical to today.
  const { member, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-bone/80 px-4 backdrop-blur-md sm:px-6">
      <button className="rounded-md p-2 text-ink-soft hover:bg-bone-2 lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </button>

      <button
        onClick={onCommand}
        className="group flex h-9 max-w-md flex-1 items-center gap-2 rounded-md border border-line-strong bg-paper px-3 text-sm text-ink-ghost transition-colors hover:border-ink-ghost"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search projects, files, clients…</span>
        <kbd className="hidden rounded border border-line bg-bone-2 px-1.5 font-mono text-[11px] text-ink-faint sm:inline">⌘K</kbd>
      </button>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onAssistant}>
          <Radar className="h-4 w-4 text-blue" />
          <span className="hidden sm:inline">Ask AI</span>
        </Button>

        <Link to="/projects/new" className="hidden sm:block">
          <Button variant="primary" size="sm">
            <Plus className="h-4 w-4" /> New project
          </Button>
        </Link>

        <Notifications />

        <Popover>
          <PopoverTrigger asChild>
            <button className="ml-1 flex items-center gap-1.5 rounded-md p-0.5 hover:bg-bone-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-tint font-mono text-[11px] font-medium text-blue">{member.initials}</span>
              <ChevronDown className="hidden h-4 w-4 text-ink-faint sm:block" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <div className="px-1 pb-2">
              <div className="text-sm font-medium text-ink">{member.name}</div>
              <div className="text-xs text-ink-faint">{member.title}</div>
            </div>
            <div className="border-t border-line pt-2 text-sm text-ink-soft">
              <Link to="/settings" className="block rounded-md px-2 py-1.5 hover:bg-bone-2">Workspace settings</Link>
              <Link to="/team" className="block rounded-md px-2 py-1.5 hover:bg-bone-2">Team & roles</Link>
              {AUTH_ENABLED ? (
                <button onClick={() => signOut()} className="block w-full rounded-md px-2 py-1.5 text-left text-rust hover:bg-rust-tint">Sign out</button>
              ) : (
                <button className="block w-full rounded-md px-2 py-1.5 text-left text-rust hover:bg-rust-tint">Sign out</button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

function Notifications() {
  const { data: approvals = [] } = useAiApprovals();
  const { data: payments = [] } = useAiPayments();
  const { data: activity = [] } = useAiActivity();
  const pending = approvals.filter((a) => a.status === "pending").length;
  const overdue = payments.filter((p) => p.status === "overdue").length;
  const count = pending + overdue;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line-strong bg-paper text-ink-soft hover:border-ink-ghost">
          <Bell className="h-[18px] w-[18px]" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rust px-1 text-[10px] font-medium text-paper tnum">
              {count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <span className="label-draft">Needs attention</span>
          <span className="text-xs text-ink-faint">{pending} approvals · {overdue} overdue</span>
        </div>
        <ul className="max-h-96 divide-y divide-line overflow-y-auto">
          {activity.slice(0, 6).map((a) => (
            <li key={a.id} className="flex gap-3 px-4 py-3 hover:bg-paper-2">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", a.type === "payment" ? "bg-rust" : a.type === "approval" ? "bg-ochre" : "bg-blue")} />
              <div className="min-w-0">
                <div className="text-sm text-ink">{a.summary}</div>
                <div className="mt-0.5 text-[11px] text-ink-ghost">{relative(a.date)} · {a.actor}</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-line p-2">
          <Link to="/activity" className="block rounded-md px-2 py-1.5 text-center text-xs font-medium text-blue hover:bg-bone-2">
            View all activity
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
