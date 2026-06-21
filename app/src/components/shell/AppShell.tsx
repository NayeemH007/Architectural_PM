import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NAV } from "@/lib/nav";
import { workspace } from "@/lib/archintel/data";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { CommandPalette } from "./CommandPalette";
import { AssistantPanel } from "./AssistantPanel";

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAssistantOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const item = NAV.flatMap((g) => g.items).find((it) =>
      it.to === "/" ? pathname === "/" : pathname === it.to || pathname.startsWith(it.to + "/"),
    );
    document.title = item ? `${item.label} · ${workspace.product}` : `${workspace.product} · ${workspace.firm}`;
  }, [pathname]);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-bone">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setNavOpen(true)} onCommand={() => setPaletteOpen(true)} onAssistant={() => setAssistantOpen(true)} />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
    </TooltipProvider>
  );
}
