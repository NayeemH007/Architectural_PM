import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav";
import { workspace } from "@/lib/archintel/data";
import { useAuth } from "@/lib/auth";
import { AUTH_ENABLED } from "@/lib/supabase";
import { ArchIntelMark } from "@/components/brand";
import { Button } from "@/components/ui/button";

function matchesPath(to: string, pathname: string) {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  // Hardcoded "Fariha Karim · FK" default when the flag is OFF → identical render.
  const { member } = useAuth();
  const activeGroup = NAV.findIndex((g) => g.items.some((it) => matchesPath(it.to, pathname)));
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>(() =>
    activeGroup >= 0 ? { [activeGroup]: true } : {},
  );
  useEffect(() => {
    if (activeGroup >= 0) setOpenGroups((s) => (s[activeGroup] ? s : { ...s, [activeGroup]: true }));
  }, [activeGroup]);
  const toggle = (i: number) => setOpenGroups((s) => ({ ...s, [i]: !s[i] }));

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-ink/20 backdrop-blur-[1px] lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-paper transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* brand */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-line px-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-blue text-paper">
              <ArchIntelMark className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold tracking-tight text-ink">{workspace.product}</div>
              <div className="label-draft !text-[10px]">Project control</div>
            </div>
          </div>
          <button className="rounded p-1 text-ink-faint hover:bg-bone-2 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* workspace + new project */}
        <div className="border-b border-line px-3 py-3">
          <div className="flex items-center gap-2 rounded-md bg-paper-2 px-2.5 py-2">
            <div className="grid h-6 w-6 place-items-center rounded bg-sienna/15 font-mono text-[10px] font-bold text-sienna">SE</div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium text-ink">{workspace.firm}</div>
              <div className="label-draft !text-[9px]">Interior studio · {workspace.city}</div>
            </div>
          </div>
          <Link to="/projects/new" onClick={onClose}>
            <Button variant="primary" size="sm" className="mt-2 w-full">
              <Plus className="h-4 w-4" /> New project
            </Button>
          </Link>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV.map((group, gi) => {
            if (!group.heading) {
              return (
                <ul key={gi} className="mb-1 space-y-0.5">
                  {group.items.map((item) => (
                    <NavItemLink key={item.to} item={item} onClose={onClose} />
                  ))}
                </ul>
              );
            }
            const isOpen = !!openGroups[gi];
            return (
              <div key={gi} className="mt-3">
                <button onClick={() => toggle(gi)} className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bone-2">
                  <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-ink-ghost transition-transform", isOpen && "rotate-90")} />
                  <span className="label-draft flex-1">{group.heading}</span>
                </button>
                {isOpen && (
                  <ul className="mt-0.5 space-y-0.5 pl-1.5">
                    {group.items.map((item) => (
                      <NavItemLink key={item.to} item={item} onClose={onClose} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* footer — current user */}
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-blue-tint font-mono text-[11px] font-medium text-blue">{member.initials}</div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium text-ink">{member.name}</div>
              <div className="label-draft !text-[9px] truncate">{AUTH_ENABLED ? member.title : "Principal · Co-Founder"}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItemLink({ item, onClose }: { item: (typeof NAV)[number]["items"][number]; onClose: () => void }) {
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === "/"}
        onClick={onClose}
        className={({ isActive }) =>
          cn(
            "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
            isActive ? "bg-blue-tint font-medium text-blue" : "text-ink-soft hover:bg-bone-2 hover:text-ink",
          )
        }
      >
        {({ isActive }) => (
          <>
            <item.icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-blue" : "text-ink-faint")} />
            <span className="flex-1">{item.label}</span>
            {item.badge === "alert" && <span className="h-1.5 w-1.5 rounded-full bg-rust" />}
            {typeof item.badge === "number" && (
              <span className="rounded-full bg-bone-2 px-1.5 text-[11px] text-ink-soft tnum">{item.badge}</span>
            )}
          </>
        )}
      </NavLink>
    </li>
  );
}
