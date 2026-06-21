import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive as ArchiveIcon,
  Search,
  FolderOpen,
  FileText,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  CalendarCheck,
  ArrowRight,
  Inbox,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AvatarStack } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/states";
import {
  FileStatusBadge,
  StorageChip,
  ApprovalStatusBadge,
  PaymentStatusBadge,
} from "@/components/archintel/badges";
import { useAiProjects } from "@/lib/archintel/api";
import {
  clientById,
  memberById,
  filesByProject,
  approvalsByProject,
  paymentsByProject,
} from "@/lib/archintel/data";
import type { ProjectA, FileRecord } from "@/lib/archintel/data";
import { bdt, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const TYPE_LABEL: Record<ProjectA["type"], string> = {
  residential: "Residential",
  hospitality: "Hospitality",
  corporate: "Corporate",
  retail: "Retail",
  healthcare: "Healthcare",
};

const TYPE_TONE: Record<ProjectA["type"], "blue" | "sage" | "ochre" | "sienna" | "neutral"> = {
  residential: "blue",
  hospitality: "ochre",
  corporate: "sienna",
  retail: "sage",
  healthcare: "neutral",
};

// Archived projects keep only their settled artefacts.
const archivedFiles = (pid: string): FileRecord[] =>
  filesByProject(pid).filter((f) => f.status === "archived" || f.kind === "final");

export default function Archive() {
  const { data: all = [], isLoading } = useAiProjects();

  const archived = useMemo(() => all.filter((p) => p.status === "archived"), [all]);

  // ---- filters (client state) ----
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");
  const [open, setOpen] = useState<ProjectA | null>(null);

  const yearOptions = useMemo(() => {
    const ys = Array.from(new Set(archived.map((p) => p.targetDate.slice(0, 4)))).sort().reverse();
    return [{ value: "all", label: "All years" }, ...ys.map((y) => ({ value: y, label: y }))];
  }, [archived]);

  const filtered = useMemo(
    () =>
      archived.filter((p) => {
        const client = clientById(p.clientId);
        const hay = `${p.name} ${p.code} ${p.address} ${client?.name ?? ""} ${TYPE_LABEL[p.type]}`.toLowerCase();
        if (q && !hay.includes(q.toLowerCase())) return false;
        if (type !== "all" && p.type !== type) return false;
        if (year !== "all" && p.targetDate.slice(0, 4) !== year) return false;
        return true;
      }),
    [archived, q, type, year],
  );

  // ---- KPIs (across the whole archive) ----
  const completedCount = archived.length;
  const deliveredValue = archived.reduce((s, p) => s + p.contractValue, 0);
  const docsArchived = archived.reduce((s, p) => s + archivedFiles(p.id).length, 0);

  const hasFilters = q !== "" || type !== "all" || year !== "all";
  const clearFilters = () => {
    setQ("");
    setType("all");
    setYear("all");
  };

  return (
    <Page>
      <PageHeader
        kicker="Project control · Archive"
        title="Archive"
        description="Completed projects, sealed and searchable. Every past drawing set, BOQ, approval and payment record lives here — independent of any one person's PC."
      />

      {/* ---- KPI row ---- */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-3 h-3 w-28" />
              <Skeleton className="h-7 w-20" />
            </Card>
          ))
        ) : (
          <>
            <KpiCard
              kicker="Completed projects"
              value={completedCount}
              footnote={<span className="text-xs text-ink-ghost">delivered & sealed</span>}
            />
            <KpiCard
              kicker="Total delivered value"
              value={bdt(deliveredValue, { compact: true })}
              footnote={<span className="text-xs text-sage">contract value across the archive</span>}
            />
            <KpiCard
              kicker="Documents archived"
              value={docsArchived}
              footnote={<span className="text-xs text-ink-ghost">drawings, BOQs & finals retained</span>}
            />
          </>
        )}
      </div>

      {/* ---- continuity note ---- */}
      <div className="mt-4 flex items-start gap-2.5 rounded-md border border-sage/30 bg-sage-tint/40 px-3.5 py-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
        <p className="text-[13px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Permanent record.</span> When a project closes, its
          final drawings, BOQs, approvals and payment history are sealed here — searchable years
          later without chasing whoever happened to own the files.
        </p>
      </div>

      {/* ---- toolbar ---- */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          placeholder="Search archive — projects, clients, addresses…"
          className="lg:max-w-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            value={type}
            onValueChange={setType}
            options={[
              { value: "all", label: "All types" },
              ...(Object.keys(TYPE_LABEL) as ProjectA["type"][]).map((t) => ({
                value: t,
                label: TYPE_LABEL[t],
              })),
            ]}
          />
          <Select size="sm" value={year} onValueChange={setYear} options={yearOptions} />
        </div>
      </div>

      {/* ---- archive cards ---- */}
      <div className="mt-5">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="mb-3 h-4 w-48" />
                <Skeleton className="mb-2 h-3 w-32" />
                <Skeleton className="h-9 w-full" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={hasFilters ? Search : ArchiveIcon}
              title={hasFilters ? "No archived projects match" : "Archive is empty"}
              description={
                hasFilters
                  ? "Try clearing a filter or search term to widen the view."
                  : "Projects move here once they are delivered and closed."
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
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filtered.map((p) => (
              <ArchiveCard key={p.id} project={p} onOpen={() => setOpen(p)} />
            ))}
          </div>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="mt-4 text-xs text-ink-ghost">
          Showing {filtered.length} of {archived.length} archived project
          {archived.length === 1 ? "" : "s"}
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

      {/* ---- archive detail dialog ---- */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {open && <ArchiveDetail project={open} />}
        </DialogContent>
      </Dialog>
    </Page>
  );
}

// ======================================================================
// Archive card — one completed project
// ======================================================================
function ArchiveCard({ project, onOpen }: { project: ProjectA; onOpen: () => void }) {
  const client = clientById(project.clientId);
  const team = project.teamIds
    .map((id) => memberById(id))
    .filter((m): m is NonNullable<ReturnType<typeof memberById>> => !!m);
  const docCount = archivedFiles(project.id).length;
  const received = paymentsByProject(project.id).reduce((s, pm) => s + pm.receivedAmount, 0);

  return (
    <Card drafting className="flex flex-col overflow-hidden">
      <CardContent className="flex flex-1 flex-col pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-draft text-ink-ghost">{project.code}</span>
              <Badge tone={TYPE_TONE[project.type]} size="sm">
                {TYPE_LABEL[project.type]}
              </Badge>
            </div>
            <h3 className="mt-1.5 font-display text-[18px] leading-tight text-ink">
              {project.name}
            </h3>
            {client && <p className="mt-0.5 text-[13px] text-ink-soft">{client.name}</p>}
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-paper-2 text-ink-faint">
            <ArchiveIcon className="h-4 w-4" />
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{project.address}</span>
        </div>

        <Separator className="my-3.5" />

        <div className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <div>
            <div className="label-draft text-ink-ghost">Completed</div>
            <div className="mt-0.5 flex items-center gap-1 text-ink">
              <CalendarCheck className="h-3.5 w-3.5 text-sage" />
              {shortDate(project.targetDate)}
            </div>
          </div>
          <div>
            <div className="label-draft text-ink-ghost">Contract value</div>
            <div className="mt-0.5 tnum text-ink">{bdt(project.contractValue, { compact: true })}</div>
          </div>
          <div>
            <div className="label-draft text-ink-ghost">Collected</div>
            <div className="mt-0.5 tnum text-sage">{bdt(received, { compact: true })}</div>
          </div>
          <div>
            <div className="label-draft text-ink-ghost">Documents</div>
            <div className="mt-0.5 tnum text-ink">{docCount} archived</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
          <div className="flex items-center gap-2">
            {team.length > 0 && (
              <AvatarStack names={team.map((m) => m.name)} tones={team.map((m) => m.tone)} />
            )}
            <span className="text-xs text-ink-ghost">
              {team.length} team member{team.length === 1 ? "" : "s"}
            </span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpen}>
            <FolderOpen className="h-4 w-4" />
            Open archive
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ======================================================================
// Archive detail — read-only files / approvals / payments
// ======================================================================
function ArchiveDetail({ project }: { project: ProjectA }) {
  const client = clientById(project.clientId);
  const docs = archivedFiles(project.id);
  const approvals = approvalsByProject(project.id);
  const pays = paymentsByProject(project.id);
  const lead = memberById(project.leadId);

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <span className="label-draft text-ink-ghost">{project.code}</span>
          <Badge tone={TYPE_TONE[project.type]} size="sm">
            {TYPE_LABEL[project.type]}
          </Badge>
          <Badge tone="neutral" size="sm">
            Archived
          </Badge>
        </div>
        <DialogTitle className="mt-1.5">{project.name}</DialogTitle>
        <DialogDescription>
          {client?.name ?? "—"} · delivered {shortDate(project.targetDate)}
          {lead ? ` · led by ${lead.name.split(" ")[0]}` : ""} · read-only record
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[62vh] overflow-y-auto px-5 py-4">
        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files">Files ({docs.length})</TabsTrigger>
            <TabsTrigger value="approvals">Approvals ({approvals.length})</TabsTrigger>
            <TabsTrigger value="payments">Payments ({pays.length})</TabsTrigger>
          </TabsList>

          {/* ---- FILES ---- */}
          <TabsContent value="files">
            {docs.length === 0 ? (
              <EmptyState icon={FileText} title="No archived documents" description="Final drawings and BOQs would appear here." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-line">
                <Table>
                  <THead>
                    <TR>
                      <TH>Document</TH>
                      <TH>Storage</TH>
                      <TH className="text-right">Version</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {docs.map((f) => (
                      <TR key={f.id}>
                        <TD>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-paper-2 text-[10px] font-semibold text-ink-faint">
                              {f.ext}
                            </span>
                            <div className="min-w-0">
                              <div className="font-medium text-ink">{f.name}</div>
                              <div className="label-draft text-ink-ghost">
                                Phase {f.phase} · {shortDate(f.uploadedDate)}
                              </div>
                            </div>
                          </div>
                        </TD>
                        <TD>
                          <StorageChip storage={f.storage} />
                        </TD>
                        <TD className="text-right tnum text-ink-soft">{f.version}</TD>
                        <TD>
                          <FileStatusBadge status={f.status} />
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ---- APPROVALS ---- */}
          <TabsContent value="approvals">
            {approvals.length === 0 ? (
              <EmptyState icon={Inbox} title="No approval records" description="Design & material sign-offs would appear here." />
            ) : (
              <div className="space-y-2.5">
                {approvals.map((a) => {
                  const submitter = memberById(a.submittedById);
                  return (
                    <div key={a.id} className="rounded-md border border-line bg-paper-2 px-3.5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-ink">{a.title}</div>
                          <div className="label-draft mt-0.5 text-ink-ghost">
                            {a.version} · Phase {a.phase} · {submitter?.name.split(" ")[0] ?? "—"}
                            {a.decidedDate ? ` · ${shortDate(a.decidedDate)}` : ""}
                          </div>
                        </div>
                        <ApprovalStatusBadge status={a.status} />
                      </div>
                      {a.comments.length > 0 && (
                        <p className="mt-2 text-[13px] leading-snug text-ink-soft">
                          “{a.comments[a.comments.length - 1].text}”
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ---- PAYMENTS ---- */}
          <TabsContent value="payments">
            {pays.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No payment records" description="Milestone payments would appear here." />
            ) : (
              <>
                <div className="overflow-hidden rounded-lg border border-line">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Milestone</TH>
                        <TH className="text-right">Amount</TH>
                        <TH className="text-right">Received</TH>
                        <TH>Status</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {pays.map((pm) => (
                        <TR key={pm.id}>
                          <TD>
                            <div className="font-medium text-ink">{pm.label}</div>
                            <div className="label-draft text-ink-ghost">
                              {pm.receivedDate ? `Paid ${shortDate(pm.receivedDate)}` : `Due ${shortDate(pm.dueDate)}`}
                            </div>
                          </TD>
                          <TD className="text-right tnum text-ink-soft">{bdt(pm.amount, { compact: true })}</TD>
                          <TD className="text-right tnum text-ink">{bdt(pm.receivedAmount, { compact: true })}</TD>
                          <TD>
                            <PaymentStatusBadge status={pm.status} />
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-md bg-sage-tint/40 px-3.5 py-2.5 text-sm">
                  <span className="text-ink-soft">Total collected</span>
                  <span className="tnum font-medium text-sage">
                    {bdt(pays.reduce((s, pm) => s + pm.receivedAmount, 0))}
                  </span>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <Separator className="my-4" />
        <Link
          to={`/projects/${project.id}`}
          className="inline-flex items-center gap-1 text-xs text-blue hover:underline"
        >
          Open full project record
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </>
  );
}
