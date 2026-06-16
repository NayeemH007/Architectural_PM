import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NAV } from "@/lib/nav";
import { firm } from "@/lib/mock/data";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AssistantPanel } from "./AssistantPanel";
import { CommandPalette } from "./CommandPalette";

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { pathname } = useLocation();

  // Per-route browser title — a small touch that reads as a real product.
  useEffect(() => {
    const item = NAV.flatMap((g) => g.items).find((it) =>
      it.to === "/" ? pathname === "/" : pathname === it.to || pathname.startsWith(it.to + "/"),
    );
    document.title = item ? `${item.label} · ${firm.name}` : `${firm.name} · Practice Intelligence`;
  }, [pathname]);

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

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-bone">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onMenu={() => setNavOpen(true)}
            onAssistant={() => setAssistantOpen(true)}
            onCommand={() => setPaletteOpen(true)}
          />
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
      <AssistantPanel open={assistantOpen} onOpenChange={setAssistantOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onAskAI={() => setAssistantOpen(true)}
      />
    </TooltipProvider>
  );
}
