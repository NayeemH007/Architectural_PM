import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as RD from "@radix-ui/react-dialog";
import { CornerDownLeft, FolderOpen, Layers, Plus, Search, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV } from "@/lib/nav";
import { useAiClients, useAiFiles, useAiProjects } from "@/lib/archintel/api";

interface CmdItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: string;
  run: () => void;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const { data: projects = [] } = useAiProjects();
  const { data: clients = [] } = useAiClients();
  const { data: files = [] } = useAiFiles();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (to: string) => {
    navigate(to);
    onOpenChange(false);
  };

  const base: CmdItem[] = useMemo(() => {
    const actions: CmdItem[] = [
      { id: "new", label: "New project", hint: "Create a project workspace", icon: Plus, group: "Actions", run: () => go("/projects/new") },
    ];
    const pages: CmdItem[] = NAV.flatMap((g) =>
      g.items.map((it) => ({ id: `p-${it.to}`, label: it.label, hint: g.heading ?? "Go to", icon: it.icon, group: "Pages", run: () => go(it.to) })),
    );
    const projs: CmdItem[] = projects.map((p) => ({
      id: `pr-${p.id}`, label: p.name, hint: `${p.code} · ${p.address}`, icon: Layers, group: "Projects", run: () => go(`/projects/${p.id}`),
    }));
    const clis: CmdItem[] = clients.map((c) => ({
      id: `cl-${c.id}`, label: c.name, hint: "Client", icon: FolderOpen, group: "Clients", run: () => go(`/clients/${c.id}`),
    }));
    const fls: CmdItem[] = files.slice(0, 30).map((f) => ({
      id: `fl-${f.id}`, label: f.name, hint: `${f.ext} · ${f.version}`, icon: FolderOpen, group: "Files", run: () => go("/files"),
    }));
    return [...actions, ...pages, ...projs, ...clis, ...fls];
  }, [projects, clients, files]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return base.filter((i) => i.group === "Actions" || i.group === "Pages");
    return base.filter((i) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(term));
  }, [q, base]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

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
              placeholder="Search projects, clients, files, or jump to a page…"
              className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-ghost"
            />
            <kbd className="rounded border border-line bg-bone-2 px-1.5 font-mono text-[11px] text-ink-faint">esc</kbd>
          </div>
          <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
            {filtered.length === 0 && <div className="px-3 py-8 text-center text-sm text-ink-faint">No matches for “{q}”.</div>}
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
                    className={cn("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm", i === active ? "bg-blue-tint text-blue" : "text-ink-soft")}
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
