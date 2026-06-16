import { useMemo, useState } from "react";
import { Cable, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KIND_ICON, SOURCE_STATUS, StatusDot } from "@/components/data-source";
import { KIND_LABELS } from "@/lib/mock/integrations";
import { relative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useDataSources } from "@/lib/api";
import type { DataSource } from "@/lib/types";

const CADENCE_LABEL: Record<string, string> = {
  realtime: "Real-time",
  near_realtime: "Near real-time",
  scheduled: "Scheduled",
  manual: "Manual",
};

export default function DataSources() {
  const { data: sources = [] } = useDataSources();
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<DataSource | null>(null);

  const counts = {
    live: sources.filter((s) => s.status === "connected" || s.status === "syncing").length,
    attention: sources.filter((s) => s.status === "stale" || s.status === "error").length,
    manual: sources.filter((s) => s.status === "manual").length,
    available: sources.filter((s) => s.status === "not_connected").length,
  };

  const grouped = useMemo(() => {
    const list = filter === "all" ? sources : sources.filter((s) => s.kind === filter);
    const byKind: Record<string, DataSource[]> = {};
    for (const s of list) (byKind[s.kind] ??= []).push(s);
    return byKind;
  }, [sources, filter]);

  return (
    <Page>
      <PageHeader
        kicker="Data & setup"
        title="Data sources & integrations"
        description="Space Esse reads from the tools you already use — it never replaces them and never writes back. Connect a source, or capture manually where no API exists."
        actions={
          <Button variant="primary">
            <Plus className="h-4 w-4" /> Add a source
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Live", value: counts.live, tone: "text-sage" },
          { label: "Needs attention", value: counts.attention, tone: "text-ochre" },
          { label: "Manual", value: counts.manual, tone: "text-sienna" },
          { label: "Available", value: counts.available, tone: "text-ink-faint" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="label-draft">{s.label}</div>
            <div className={cn("mt-1 font-display text-2xl tnum", s.tone)}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* read-only assurance */}
      <Card className="mt-4 flex items-center gap-3 border-sage/30 bg-sage-tint/50 p-4">
        <ShieldCheck className="h-5 w-5 shrink-0 text-sage" />
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">Read-only by design.</span> Every connector requests least-privilege,
          read-only access. Your source systems remain the single source of truth — Space Esse only observes.
        </p>
      </Card>

      <div className="mt-6 flex items-center justify-between">
        <Select
          size="sm"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "all", label: "All categories" },
            ...Object.entries(KIND_LABELS).map(([v, l]) => ({ value: v, label: l })),
          ]}
        />
        <span className="text-xs text-ink-faint">Click a source for details</span>
      </div>

      <div className="mt-4 space-y-7">
        {Object.entries(grouped).map(([kind, list]) => {
          const Icon = KIND_ICON[kind as DataSource["kind"]];
          return (
            <section key={kind}>
              <div className="mb-2.5 flex items-center gap-2">
                <Icon className="h-4 w-4 text-ink-faint" />
                <h2 className="font-display text-base text-ink">{KIND_LABELS[kind as DataSource["kind"]]}</h2>
                <span className="text-xs text-ink-ghost">({list.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((s) => (
                  <SourceTile key={s.id} s={s} onClick={() => setSelected(s)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && <SourceDetail s={selected} />}
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function SourceTile({ s, onClick }: { s: DataSource; onClick: () => void }) {
  const connected = s.status !== "not_connected";
  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer p-4 transition-shadow hover:shadow-lift",
        !connected && "border-dashed bg-paper-2",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-md font-display text-lg",
              connected ? "bg-blue-tint text-blue" : "bg-bone-2 text-ink-ghost",
            )}
          >
            {s.logoGlyph}
          </div>
          <div>
            <div className="font-medium text-ink">{s.name}</div>
            <div className="text-xs text-ink-faint">{s.vendor}</div>
          </div>
        </div>
        {s.mvp && connected && <Badge tone="blue" size="sm">MVP</Badge>}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        <StatusDot status={s.status} pulse />
        <span className={cn("font-medium", SOURCE_STATUS[s.status].text)}>{SOURCE_STATUS[s.status].label}</span>
        {connected && <span className="text-ink-ghost">· {CADENCE_LABEL[s.cadence]}</span>}
      </div>

      {connected ? (
        <>
          <div className="mt-3 flex items-center justify-between text-[11px] text-ink-faint">
            <span>{s.lastSync ? `Synced ${relative(s.lastSync)}` : "—"}</span>
            <span className="tnum">{s.recordsIngested.toLocaleString()} records</span>
          </div>
          <Progress
            value={s.health}
            tone={s.health > 80 ? "sage" : s.health > 55 ? "ochre" : "rust"}
            className="mt-2"
          />
        </>
      ) : (
        <Button variant="outline" size="sm" className="mt-4 w-full">
          <Cable className="h-3.5 w-3.5" /> Connect
        </Button>
      )}
    </Card>
  );
}

function SourceDetail({ s }: { s: DataSource }) {
  const connected = s.status !== "not_connected";
  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-blue-tint font-display text-xl text-blue">
            {s.logoGlyph}
          </div>
          <div>
            <DialogTitle>{s.name}</DialogTitle>
            <DialogDescription>
              {s.vendor} · {KIND_LABELS[s.kind]}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div className="space-y-4 p-5">
        <p className="text-sm text-ink-soft">{s.notes}</p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Status", SOURCE_STATUS[s.status].label],
            ["Method", s.method.replace("_", " ")],
            ["Cadence", CADENCE_LABEL[s.cadence]],
            ["Auth", s.authMethod],
            ["Access", s.readOnly ? "Read-only" : "Read / write"],
            ["Last sync", s.lastSync ? relative(s.lastSync) : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-md border border-line bg-paper-2 px-3 py-2">
              <div className="label-draft !text-[10px]">{k}</div>
              <div className="mt-0.5 text-ink">{v}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="label-draft mb-1.5">Feeds these records</div>
          <div className="flex flex-wrap gap-1.5">
            {s.feeds.map((f) => (
              <Badge key={f} tone="neutral" size="sm">{f}</Badge>
            ))}
          </div>
        </div>

        {connected && (
          <div className="flex items-center justify-between rounded-md border border-line bg-paper-2 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm text-ink">
              <RefreshCw className="h-4 w-4 text-ink-faint" /> Auto-sync
            </div>
            <Switch defaultChecked={s.status === "connected" || s.status === "syncing"} />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          {connected ? (
            <>
              <Button variant="outline" size="sm"><RefreshCw className="h-3.5 w-3.5" /> Sync now</Button>
              <Button variant="ghost" size="sm" className="text-rust">Disconnect</Button>
            </>
          ) : (
            <Button variant="primary" size="sm"><Cable className="h-3.5 w-3.5" /> Connect {s.name}</Button>
          )}
        </div>
      </div>
    </>
  );
}
