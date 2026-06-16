import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2,
  FileStack,
  Layers,
  MessageSquare,
  Receipt,
  Search as SearchIcon,
  User,
} from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGE_LABELS, HealthBadge } from "@/components/status";
import { EmptyState } from "@/components/states";
import { bdt, shortDate, relative } from "@/lib/format";
import { cn } from "@/lib/cn";
import {
  useClients,
  useDecisions,
  useDeliverables,
  useEmployees,
  useInvoices,
  useProjects,
} from "@/lib/api";
import type {
  Client,
  Decision,
  Deliverable,
  Employee,
  Invoice,
  Project,
} from "@/lib/types";

type Tone = "neutral" | "blue" | "sage" | "ochre" | "sienna" | "rust" | "ink";

interface ResultRow {
  key: string;
  icon: typeof SearchIcon;
  primary: string;
  secondary: string;
  badge?: { label: string; tone: Tone };
  to: string | null;
  trailing?: React.ReactNode;
}

interface ResultGroup {
  key: string;
  label: string;
  icon: typeof SearchIcon;
  tone: Tone;
  rows: ResultRow[];
}

const has = (haystack: (string | null | undefined)[], needle: string) =>
  haystack.some((h) => (h ?? "").toLowerCase().includes(needle));

/** A single result line: icon + primary text + secondary hint + "open" affordance. */
function Row({ row }: { row: ResultRow }) {
  const inner = (
    <>
      <span className="mt-0.5 shrink-0 text-ink-ghost group-hover:text-blue">
        <row.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{row.primary}</span>
          {row.badge && (
            <Badge tone={row.badge.tone} size="sm">
              {row.badge.label}
            </Badge>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-faint">{row.secondary}</span>
      </span>
      {row.trailing && <span className="shrink-0 self-center tnum text-xs text-ink-soft">{row.trailing}</span>}
      {row.to && (
        <span className="shrink-0 self-center text-[11px] font-medium text-ink-ghost opacity-0 transition-opacity group-hover:opacity-100">
          open →
        </span>
      )}
    </>
  );

  const cls =
    "group flex items-start gap-3 rounded-md border border-transparent px-2.5 py-2.5 transition-colors hover:border-line hover:bg-paper-2";

  return row.to ? (
    <Link to={row.to} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cn(cls, "cursor-default")}>{inner}</div>
  );
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";

  const [term, setTerm] = useState(q);
  // keep the input in sync when the URL query changes (e.g. via command palette)
  useEffect(() => setTerm(q), [q]);

  const projects = useProjects();
  const clients = useClients();
  const invoices = useInvoices();
  const decisions = useDecisions();
  const employees = useEmployees();
  const deliverables = useDeliverables();

  const isLoading =
    projects.isLoading ||
    clients.isLoading ||
    invoices.isLoading ||
    decisions.isLoading ||
    employees.isLoading ||
    deliverables.isLoading;

  const groups = useMemo<ResultGroup[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];

    const proj = (projects.data ?? []) as Project[];
    const cli = (clients.data ?? []) as Client[];
    const inv = (invoices.data ?? []) as Invoice[];
    const dec = (decisions.data ?? []) as Decision[];
    const emp = (employees.data ?? []) as Employee[];
    const del = (deliverables.data ?? []) as Deliverable[];

    const projectRows: ResultRow[] = proj
      .filter((p) => has([p.name, p.code, p.client], needle))
      .map((p) => ({
        key: p.id,
        icon: Layers,
        primary: p.name,
        secondary: `${p.code} · ${p.client} · ${STAGE_LABELS[p.stage]}`,
        to: `/projects/${p.id}`,
        trailing: <HealthBadge band={p.health} size="sm" />,
      }));

    const clientRows: ResultRow[] = cli
      .filter((c) => has([c.name, c.city], needle))
      .map((c) => ({
        key: c.id,
        icon: Building2,
        primary: c.name,
        secondary: `${c.city} · ${c.activeProjects} active project${c.activeProjects === 1 ? "" : "s"}`,
        badge: { label: c.type, tone: "neutral" },
        to: `/clients/${c.id}`,
        trailing: c.outstanding > 0 ? `${bdt(c.outstanding, { compact: true })} due` : undefined,
      }));

    const invoiceRows: ResultRow[] = inv
      .filter((i) => has([i.number, i.client], needle))
      .map((i) => ({
        key: i.id,
        icon: Receipt,
        primary: i.number,
        secondary: `${i.client} · issued ${shortDate(i.issueDate)}`,
        badge: { label: i.status.replace("_", " "), tone: i.status === "overdue" ? "rust" : i.status === "paid" ? "sage" : "blue" },
        to: `/projects/${i.projectId}`,
        trailing: bdt(i.netReceivable, { compact: true }),
      }));

    const peopleRows: ResultRow[] = emp
      .filter((e) => has([e.name, e.role, e.title], needle))
      .map((e) => ({
        key: e.id,
        icon: User,
        primary: e.name,
        secondary: `${e.title} · ${e.role}`,
        badge: { label: `${e.activeProjects} projects`, tone: "neutral" },
        to: null,
      }));

    const decisionRows: ResultRow[] = dec
      .filter((d) => has([d.summary, d.decidedBy], needle))
      .map((d) => ({
        key: d.id,
        icon: MessageSquare,
        primary: d.summary,
        secondary: `${d.decidedBy} · ${d.channel} · ${relative(d.date)}`,
        badge: d.promoted ? { label: "verified", tone: "sage" } : { label: "unconfirmed", tone: "ochre" },
        to: `/projects/${d.projectId}`,
      }));

    const deliverableRows: ResultRow[] = del
      .filter((d) => has([d.name, d.discipline], needle))
      .map((d) => ({
        key: d.id,
        icon: FileStack,
        primary: d.name,
        secondary: `${d.discipline} · ${d.revision} · due ${shortDate(d.dueDate)}`,
        badge: { label: d.status.replace("_", " "), tone: d.status === "revise" ? "sienna" : "neutral" },
        to: `/projects/${d.projectId}`,
      }));

    return [
      { key: "projects", label: "Projects", icon: Layers, tone: "blue" as Tone, rows: projectRows },
      { key: "clients", label: "Clients", icon: Building2, tone: "ochre" as Tone, rows: clientRows },
      { key: "invoices", label: "Invoices", icon: Receipt, tone: "sage" as Tone, rows: invoiceRows },
      { key: "people", label: "People", icon: User, tone: "sienna" as Tone, rows: peopleRows },
      { key: "decisions", label: "Decisions", icon: MessageSquare, tone: "neutral" as Tone, rows: decisionRows },
      { key: "deliverables", label: "Deliverables", icon: FileStack, tone: "ink" as Tone, rows: deliverableRows },
    ].filter((g) => g.rows.length > 0);
  }, [q, projects.data, clients.data, invoices.data, decisions.data, employees.data, deliverables.data]);

  const total = useMemo(() => groups.reduce((s, g) => s + g.rows.length, 0), [groups]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = term.trim();
    if (value) setParams({ q: value });
    else setParams({});
  };

  return (
    <Page>
      <PageHeader
        kicker="Search"
        title={q ? `Results for “${q}”` : "Search"}
        description="One query across projects, clients, invoices, people, decisions and deliverables — matched into a single index."
      />

      <form onSubmit={submit} className="mt-6">
        <SearchInput
          className="sm:max-w-xl"
          placeholder="Search the whole practice…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoFocus
        />
      </form>

      {q && (
        <p className="mt-3 text-xs text-ink-ghost">
          {isLoading ? (
            "Searching…"
          ) : (
            <>
              <span className="tnum font-medium text-ink-soft">{total}</span> result{total === 1 ? "" : "s"}
              {total > 0 && (
                <>
                  {" "}
                  across <span className="tnum">{groups.length}</span> categor{groups.length === 1 ? "y" : "ies"}
                </>
              )}
            </>
          )}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {isLoading && q ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <Skeleton className="mb-3 h-3 w-24" />
                <Skeleton className="mb-2 h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        ) : !q ? (
          <Card>
            <EmptyState
              icon={SearchIcon}
              title="Type a query to search"
              description="Find any project, client, invoice, teammate, decision or deliverable across the practice. Try a project code, a client name, or an invoice number."
            />
          </Card>
        ) : total === 0 ? (
          <Card>
            <EmptyState
              icon={SearchIcon}
              title={`No results for “${q}”`}
              description="Nothing matched across projects, clients, invoices, people, decisions or deliverables. Check the spelling or try a broader term."
            />
          </Card>
        ) : (
          groups.map((g) => (
            <PageSection key={g.key}>
              <Card>
                <CardHeader>
                  <div className="min-w-0">
                    <CardKicker className="flex items-center gap-1.5">
                      <g.icon className="h-3.5 w-3.5" />
                      {g.label}
                    </CardKicker>
                    <CardTitle>
                      {g.rows.length} match{g.rows.length === 1 ? "" : "es"}
                    </CardTitle>
                  </div>
                  <Badge tone={g.tone} size="sm">
                    {g.rows.length}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="-mx-1 flex flex-col divide-y divide-line/60">
                    {g.rows.map((row) => (
                      <Row key={row.key} row={row} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </PageSection>
          ))
        )}
      </div>

      {q && !isLoading && total > 0 && (
        <p className="mt-6 text-xs text-ink-ghost">
          Case-insensitive substring match on names, codes, clients and free-text fields across six live datasets.
        </p>
      )}
    </Page>
  );
}
