import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as RD from "@radix-ui/react-dialog";
import { ArrowRight, CornerDownLeft, PencilLine, Search, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav";
import { useProjects } from "@/lib/api";

interface CmdItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onAskAI,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAskAI: (q?: string) => void;
}) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (to: string) => {
    navigate(to);
    onOpenChange(false);
  };

  const base: CmdItem[] = useMemo(() => {
    const actions: CmdItem[] = [
      { id: "a-ask", label: "Ask Space Esse AI", hint: "Natural-language analytics", icon: Sparkles, group: "Actions", run: () => { onOpenChange(false); onAskAI(); } },
      { id: "a-capture", label: "New capture", hint: "Log a decision, approval or effort", icon: PencilLine, group: "Actions", run: () => go("/capture") },
    ];
    const pages: CmdItem[] = NAV.flatMap((g) =>
      g.items.map((it) => ({
        id: `p-${it.to}`,
        label: it.label,
        hint: g.heading ?? "Navigate",
        icon: it.icon,
        group: "Pages",
        run: () => go(it.to),
      })),
    );
    const projs: CmdItem[] = projects.map((p) => ({
      id: `pr-${p.id}`,
      label: p.name,
      hint: `${p.code} · ${p.client}`,
      icon: ArrowRight,
      group: "Projects",
      run: () => go(`/projects/${p.id}`),
    }));
    return [...actions, ...pages, ...projs];
  }, [projects]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const matched = term
      ? base.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(term))
      : base;
    if (term) {
      return [
        { id: "q-ask", label: `Ask AI: “${q}”`, hint: "Cited answer", icon: Sparkles, group: "Ask", run: () => { onOpenChange(false); onAskAI(q); } },
        { id: "q-search", label: `Search everywhere for “${q}”`, hint: "Projects, invoices, people, decisions", icon: Search, group: "Ask", run: () => go(`/search?q=${encodeURIComponent(q)}`) },
        ...matched,
      ];
    }
    return matched;
  }, [q, base]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);
  useEffect(() => setActive(0), [q]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  // group consecutive items for headers
  let lastGroup = "";

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-rise" />
        <RD.Content
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-paper shadow-pop outline-none data-[state=open]:animate-rise"
        >
          <RD.Title className="sr-only">Command palette</RD.Title>
          <div className="flex items-center gap-2.5 border-b border-line px-4">
            <Search className="h-4 w-4 text-ink-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects, pages, people — or ask the AI…"
              className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-ghost"
            />
            <kbd className="rounded border border-line bg-bone-2 px-1.5 font-mono text-[11px] text-ink-faint">esc</kbd>
          </div>
          <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-ink-faint">No matches for “{q}”.</div>
            )}
            {filtered.map((it, i) => {
              const showGroup = it.group !== lastGroup;
              lastGroup = it.group;
              return (
                <div key={it.id}>
                  {showGroup && <div className="label-draft px-2.5 pb-1 pt-2">{it.group}</div>}
                  <button
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => it.run()}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm",
                      i === active ? "bg-blue-tint text-blue" : "text-ink-soft",
                    )}
                  >
                    <it.icon className={cn("h-4 w-4 shrink-0", i === active ? "text-blue" : "text-ink-faint")} />
                    <span className="flex-1 truncate text-ink">{it.label}</span>
                    {it.hint && <span className="truncate text-xs text-ink-ghost">{it.hint}</span>}
                    {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-blue" />}
                  </button>
                </div>
              );
            })}
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
