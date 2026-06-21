import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Phone,
  MessageCircle,
  Building2,
  ChevronRight,
  LayoutGrid,
  Rows3,
  Mail,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/states";
import { KpiCard } from "@/components/kpi-card";
import { SubmissionStatusBadge } from "@/components/archintel/badges";
import { useAiClients } from "@/lib/archintel/api";
import { projectsA, submissions } from "@/lib/archintel/data";
import type { ClientA, ClientSubmission, ProjectA } from "@/lib/archintel/data";
import { cn } from "@/lib/cn";

// --- presentation maps -------------------------------------------------------

const TYPE_LABELS: Record<ClientA["type"], string> = {
  residential: "Residential",
  hospitality: "Hospitality",
  corporate: "Corporate",
  retail: "Retail",
  healthcare: "Healthcare",
};

const TYPE_TONE: Record<ClientA["type"], string> = {
  residential: "blue",
  hospitality: "ochre",
  corporate: "sienna",
  retail: "sage",
  healthcare: "rust",
};

// Most-advanced submission state wins, so the chip reflects where the client
// conversation actually stands rather than the oldest package on file.
const SUB_RANK: Record<ClientSubmission["status"], number> = {
  approved: 3,
  revision_requested: 2,
  feedback: 1,
  sent: 0,
};

// --- derived per-client shape ------------------------------------------------

interface ClientRow {
  client: ClientA;
  projects: ProjectA[];
  activeCount: number;
  latestSub: ClientSubmission | null;
}

function latestSubmissionFor(projectIds: string[]): ClientSubmission | null {
  const mine = submissions.filter((s) => projectIds.includes(s.projectId));
  if (mine.length === 0) return null;
  // Prefer the furthest-along status; break ties by most recent send date.
  return [...mine].sort((a, b) => {
    const r = SUB_RANK[b.status] - SUB_RANK[a.status];
    if (r !== 0) return r;
    return b.sentDate.localeCompare(a.sentDate);
  })[0];
}

export default function Clients() {
  const { data: clients = [], isLoading } = useAiClients();

  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [view, setView] = useState<"cards" | "table">("cards");

  // Build the enriched directory once per client list. projectsA / submissions
  // are module-level mock data, so they are stable across renders.
  const rows = useMemo<ClientRow[]>(() => {
    return clients.map((client) => {
      const projects = projectsA.filter((p) => p.clientId === client.id);
      const activeCount = projects.filter((p) => p.status === "active").length;
      return {
        client,
        projects,
        activeCount,
        latestSub: latestSubmissionFor(projects.map((p) => p.id)),
      };
    });
  }, [clients]);

  const filtered = useMemo(() => {
    return rows.filter(({ client }) => {
      if (type !== "all" && client.type !== type) return false;
      if (q) {
        const hay =
          `${client.name} ${client.contactName} ${client.phone} ${client.whatsappGroup}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [rows, q, type]);

  // --- KPI figures (whole directory, not the filtered view) ---
  const totalClients = rows.length;
  const activeProjectCount = rows.reduce((s, r) => s + r.activeCount, 0);
  const byType = useMemo(() => {
    const m = new Map<ClientA["type"], number>();
    rows.forEach((r) => m.set(r.client.type, (m.get(r.client.type) ?? 0) + 1));
    return m;
  }, [rows]);
  const topType = useMemo<{ type: ClientA["type"]; n: number } | null>(() => {
    const entries = Array.from(byType.entries());
    if (entries.length === 0) return null;
    return entries
      .map(([type, n]) => ({ type, n }))
      .sort((a, b) => b.n - a.n)[0];
  }, [byType]);

  const typeOptions = useMemo(
    () => [
      { value: "all", label: "All types" },
      ...(Object.keys(TYPE_LABELS) as ClientA["type"][])
        .filter((t) => (byType.get(t) ?? 0) > 0)
        .map((t) => ({ value: t, label: `${TYPE_LABELS[t]} · ${byType.get(t)}` })),
    ],
    [byType],
  );

  const hasFilters = q !== "" || type !== "all";
  const clearFilters = () => {
    setQ("");
    setType("all");
  };

  return (
    <Page>
      <PageHeader
        kicker="Relationships"
        title="Clients"
        description="The studio's client directory — contacts, active engagements, and where each WhatsApp conversation stands."
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-3 h-3 w-20" />
              <Skeleton className="h-7 w-16" />
            </Card>
          ))
        ) : (
          <>
            <KpiCard
              kicker="Total clients"
              value={String(totalClients)}
              footnote={
                <span className="text-xs text-ink-ghost">{typeOptions.length - 1} segments</span>
              }
            />
            <KpiCard
              kicker="Active projects"
              value={String(activeProjectCount)}
              footnote={
                <span className="text-xs text-ink-ghost">
                  across {rows.filter((r) => r.activeCount > 0).length} clients
                </span>
              }
            />
            <KpiCard
              kicker="Largest segment"
              value={topType ? TYPE_LABELS[topType.type] : "—"}
              footnote={
                <span className="text-xs text-ink-ghost">
                  {topType ? `${topType.n} clients` : "—"}
                </span>
              }
            />
            <KpiCard
              kicker="Awaiting client"
              value={String(
                rows.filter((r) => r.latestSub && r.latestSub.status !== "approved").length,
              )}
              footnote={<span className="text-xs text-ink-ghost">open submissions</span>}
            />
          </>
        )}
      </div>

      {/* toolbar */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          placeholder="Search clients, contacts, groups…"
          className="lg:max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select size="sm" value={type} onValueChange={setType} options={typeOptions} />
          <div className="flex rounded-md border border-line-strong bg-paper p-0.5">
            <button
              aria-label="Card view"
              className={cn(
                "rounded p-1.5 transition-colors",
                view === "cards" ? "bg-blue-tint text-blue" : "text-ink-faint hover:text-ink",
              )}
              onClick={() => setView("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              aria-label="Table view"
              className={cn(
                "rounded p-1.5 transition-colors",
                view === "table" ? "bg-blue-tint text-blue" : "text-ink-faint hover:text-ink",
              )}
              onClick={() => setView("table")}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="mt-5">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="mb-3 h-4 w-32" />
                <Skeleton className="mb-2 h-3 w-24" />
                <Skeleton className="mt-4 h-8 w-full" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={Users}
              title={hasFilters ? "No clients match" : "No clients yet"}
              description={
                hasFilters
                  ? "Try a different search term or widen the type filter."
                  : "New clients appear here as projects are onboarded."
              }
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((row) => (
              <ClientCard key={row.client.id} row={row} />
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Client</TH>
                  <TH>Type</TH>
                  <TH>Contact</TH>
                  <TH className="text-right">Active</TH>
                  <TH>WhatsApp group</TH>
                  <TH>Latest submission</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {filtered.map(({ client, activeCount, latestSub }) => (
                  <TR key={client.id} interactive>
                    <TD>
                      <Link
                        to={`/clients/${client.id}`}
                        className="flex items-center gap-2.5 font-medium text-ink hover:text-blue"
                      >
                        <Avatar name={client.name} tone={TYPE_TONE[client.type]} size="sm" />
                        {client.name}
                      </Link>
                    </TD>
                    <TD>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          tonePill(client.type),
                        )}
                      >
                        {TYPE_LABELS[client.type]}
                      </span>
                    </TD>
                    <TD>
                      <div className="text-ink-soft">{client.contactName}</div>
                      <div className="tnum text-xs text-ink-faint">{client.phone}</div>
                    </TD>
                    <TD className="text-right">
                      <span
                        className={cn(
                          "tnum font-medium",
                          activeCount > 0 ? "text-ink" : "text-ink-ghost",
                        )}
                      >
                        {activeCount}
                      </span>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                        <MessageCircle className="h-3.5 w-3.5 text-sage" />
                        <span className="max-w-[14rem] truncate">{client.whatsappGroup}</span>
                      </span>
                    </TD>
                    <TD>
                      {latestSub ? (
                        <SubmissionStatusBadge status={latestSub.status} />
                      ) : (
                        <span className="text-xs text-ink-ghost">No submissions</span>
                      )}
                    </TD>
                    <TD className="text-right">
                      <Link to={`/clients/${client.id}`} aria-label={`Open ${client.name}`}>
                        <ChevronRight className="ml-auto h-4 w-4 text-ink-ghost" />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="mt-4 text-xs text-ink-ghost">
          Showing {filtered.length} of {rows.length} {rows.length === 1 ? "client" : "clients"}
          {hasFilters && (
            <>
              {" · "}
              <button className="text-blue hover:underline" onClick={clearFilters}>
                clear filters
              </button>
            </>
          )}
        </p>
      )}
    </Page>
  );
}

// pill colour classes reused by card + table type chips
function tonePill(type: ClientA["type"]) {
  const tone = TYPE_TONE[type];
  return {
    blue: "border-blue/20 bg-blue-tint text-blue",
    ochre: "border-ochre/25 bg-ochre-tint text-ochre",
    sienna: "border-sienna/25 bg-sienna-tint text-sienna",
    sage: "border-sage/25 bg-sage-tint text-sage",
    rust: "border-rust/25 bg-rust-tint text-rust",
  }[tone];
}

function ClientCard({ row }: { row: ClientRow }) {
  const { client, activeCount, projects, latestSub } = row;
  const totalProjects = projects.length;

  return (
    <Link to={`/clients/${client.id}`} className="group block focus:outline-none">
      <Card className="flex h-full flex-col transition-shadow group-hover:shadow-lift group-focus-visible:ring-2 group-focus-visible:ring-blue/25">
        <CardContent className="flex flex-1 flex-col pb-4 pt-4">
          {/* header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={client.name} tone={TYPE_TONE[client.type]} size="md" />
              <div className="min-w-0">
                <div className="label-draft">{TYPE_LABELS[client.type]}</div>
                <h3 className="mt-0.5 truncate font-display text-[17px] leading-tight text-ink group-hover:text-blue">
                  {client.name}
                </h3>
                <div className="mt-0.5 truncate text-xs text-ink-faint">{client.contactName}</div>
              </div>
            </div>
            <span
              className={cn(
                "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                tonePill(client.type),
              )}
            >
              <Building2 className="mr-1 h-3 w-3" />
              {activeCount}
            </span>
          </div>

          {/* contact rows */}
          <div className="mt-4 space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-ink-soft">
              <Phone className="h-3.5 w-3.5 shrink-0 text-ink-ghost" />
              <span className="tnum">{client.phone}</span>
            </div>
            <Tooltip content={client.email}>
              <div className="flex items-center gap-2 text-ink-soft">
                <Mail className="h-3.5 w-3.5 shrink-0 text-ink-ghost" />
                <span className="truncate">{client.email}</span>
              </div>
            </Tooltip>
            <div className="flex items-center gap-2 text-ink-soft">
              <MessageCircle className="h-3.5 w-3.5 shrink-0 text-sage" />
              <span className="truncate">{client.whatsappGroup}</span>
            </div>
          </div>
        </CardContent>

        <CardFooter className="mt-auto">
          <span className="text-[11px] text-ink-faint">
            {activeCount} active{" "}
            <span className="text-ink-ghost">· {totalProjects} total</span>
          </span>
          {latestSub ? (
            <SubmissionStatusBadge status={latestSub.status} />
          ) : (
            <span className="text-[11px] text-ink-ghost">No submissions</span>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
