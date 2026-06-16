import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav";
import { firm } from "@/lib/mock/data";
import { Mark } from "@/components/brand";

function matchesPath(to: string, pathname: string) {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pathname } = useLocation();
  const activeGroup = NAV.findIndex((g) => g.items.some((it) => matchesPath(it.to, pathname)));

  // Groups collapsed by default; only the active route's group starts open.
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>(() =>
    activeGroup >= 0 ? { [activeGroup]: true } : {},
  );

  // When navigating into a collapsed group, reveal it (without closing others).
  useEffect(() => {
    if (activeGroup >= 0) setOpenGroups((s) => (s[activeGroup] ? s : { ...s, [activeGroup]: true }));
  }, [activeGroup]);

  const toggle = (i: number) => setOpenGroups((s) => ({ ...s, [i]: !s[i] }));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-ink/20 backdrop-blur-[1px] lg:hidden" onClick={onClose} />
      )}
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
              <Mark className="h-[18px] w-[18px]" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-[15px] font-bold tracking-tight text-ink">{firm.name}</div>
              <div className="label-draft !text-[10px]">Practice intelligence</div>
            </div>
          </div>
          <button className="rounded p-1 text-ink-faint hover:bg-bone-2 lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((group, gi) => {
            // Group with no heading (Dashboard) always renders.
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
            const hasAlert = group.items.some((it) => it.badge === "alert");
            const containsActive = gi === activeGroup;
            return (
              <div key={gi} className="mt-3">
                <button
                  onClick={() => toggle(gi)}
                  className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-bone-2"
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 text-ink-ghost transition-transform",
                      isOpen && "rotate-90",
                    )}
                  />
                  <span className={cn("label-draft flex-1", containsActive && !isOpen && "!text-blue")}>
                    {group.heading}
                  </span>
                  {!isOpen && hasAlert && <span className="h-1.5 w-1.5 rounded-full bg-rust" />}
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

        {/* footer */}
        <div className="border-t border-line p-3">
          <div className="rounded-md bg-paper-2 p-3">
            <div className="flex items-center justify-between">
              <span className="label-draft">Firm data health</span>
              <span className="font-mono text-xs font-medium text-ochre">68%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bone-2">
              <div className="h-full rounded-full bg-ochre" style={{ width: "68%" }} />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-faint">
              Improving as the team captures more. Timesheets are the biggest gap.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavItemLink({
  item,
  onClose,
}: {
  item: (typeof NAV)[number]["items"][number];
  onClose: () => void;
}) {
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
