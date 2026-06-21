import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Upload,
  HardDrive,
  ShieldAlert,
  FolderUp,
  ExternalLink,
  CheckCircle2,
  FileText,
  X,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/states";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { FileStatusBadge, StorageChip } from "@/components/archintel/badges";
import { useAiFiles } from "@/lib/archintel/api";
import { projectById, memberById } from "@/lib/archintel/data";
import type { FileRecord, FileKind } from "@/lib/archintel/data";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const KIND_LABELS: Record<FileKind, string> = {
  drawing: "Drawing",
  render: "Render",
  boq: "BOQ",
  presentation: "Presentation",
  material_sheet: "Material sheet",
  brief: "Brief",
  site_doc: "Site doc",
  final: "Final",
};

// A file "needs archiving" when its work is done but it still lives outside ArchIntel.
const needsArchiving = (f: FileRecord) =>
  f.storage !== "archintel" && (f.status === "approved" || f.status === "superseded");

export default function Files() {
  const { data: all = [], isLoading } = useAiFiles();

  // ---- filters ----
  const [q, setQ] = useState("");
  const [project, setProject] = useState("all");
  const [kind, setKind] = useState("all");
  const [storage, setStorage] = useState("all");
  const [status, setStatus] = useState("all");

  // ---- local workflow state (no persistence) ----
  // Files the user has "moved to ArchIntel" this session → re-homed locally.
  const [moved, setMoved] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  // Apply the optimistic "moved" overrides on top of the mock data.
  const files = useMemo<FileRecord[]>(
    () =>
      all.map((f) =>
        moved[f.id] ? { ...f, storage: "archintel" as const } : f,
      ),
    [all, moved],
  );

  // Project options drawn only from projects that actually own files.
  const projectOptions = useMemo(() => {
    const ids = Array.from(new Set(all.map((f) => f.projectId)));
    return ids
      .map((id) => projectById(id))
      .filter((p): p is NonNullable<ReturnType<typeof projectById>> => !!p)
      .map((p) => ({ value: p.id, label: p.code }));
  }, [all]);

  const filtered = useMemo(
    () =>
      files.filter((f) => {
        const proj = projectById(f.projectId);
        const owner = memberById(f.ownerId)?.name ?? "";
        const hay = `${f.name} ${f.ext} ${proj?.name ?? ""} ${proj?.code ?? ""} ${owner}`.toLowerCase();
        if (q && !hay.includes(q.toLowerCase())) return false;
        if (project !== "all" && f.projectId !== project) return false;
        if (kind !== "all" && f.kind !== kind) return false;
        if (storage !== "all" && f.storage !== storage) return false;
        if (status !== "all" && f.status !== status) return false;
        return true;
      }),
    [files, q, project, kind, storage, status],
  );

  // ---- KPIs (across the whole register, not the filtered view) ----
  const total = files.length;
  const onLocal = files.filter((f) => f.storage === "local").length;
  const inArchintel = files.filter((f) => f.storage === "archintel").length;
  const toArchive = files.filter(needsArchiving).length;

  const hasFilters =
    q !== "" ||
    project !== "all" ||
    kind !== "all" ||
    storage !== "all" ||
    status !== "all";
  const clearFilters = () => {
    setQ("");
    setProject("all");
    setKind("all");
    setStorage("all");
    setStatus("all");
  };

  const moveToArchintel = (f: FileRecord) => {
    setMoved((s) => ({ ...s, [f.id]: true }));
    flash(`${f.name} moved to ArchIntel`);
  };

  return (
    <Page>
      <PageHeader
        kicker="Project control · File register"
        title="Files"
        description="Every project file the studio is tracking — who owns it, where it physically lives, its version and whether it has been archived to ArchIntel."
        actions={
          <Button
            className="gap-1.5"
            onClick={() => flash("Upload is a prototype — wire to storage later")}
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        }
      />

      {/* ---- KPI row ---- */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-2 h-3 w-24" />
              <Skeleton className="h-7 w-14" />
            </Card>
          ))
        ) : (
          <>
            <KpiCard kicker="Total files" value={total} footnote="across all projects" />
            <KpiCard
              kicker="On personal / local PC"
              value={onLocal}
              footnote={
                <span className="text-xs text-ochre">single-person dependency</span>
              }
            />
            <KpiCard
              kicker="In ArchIntel"
              value={inArchintel}
              footnote={
                <span className="text-xs text-sage">{`${total ? Math.round((inArchintel / total) * 100) : 0}% centralised`}</span>
              }
            />
            <KpiCard
              kicker="Needs archiving"
              value={toArchive}
              footnote={
                <span className="text-xs text-ink-ghost">approved / superseded, still outside</span>
              }
            />
          </>
        )}
      </div>

      {/* ---- continuity-risk note (studio audit) ---- */}
      <div className="mt-4 flex items-start gap-2.5 rounded-md border border-ochre/30 bg-ochre-tint/50 px-3.5 py-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-ochre" />
        <p className="text-[13px] leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Continuity risk.</span> Files kept on a{" "}
          <span className="font-medium">Local PC</span> or a personal Google Drive can&apos;t be
          recovered if that team member is away — the studio audit flagged these as a
          single-person dependency. Move finished work to{" "}
          <span className="font-medium text-sage">ArchIntel</span> so the whole team keeps access.
        </p>
      </div>

      {/* ---- toolbar ---- */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          placeholder="Search files, projects, owners…"
          className="lg:max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            value={project}
            onValueChange={setProject}
            options={[{ value: "all", label: "All projects" }, ...projectOptions]}
          />
          <Select
            size="sm"
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "all", label: "All kinds" },
              ...(Object.keys(KIND_LABELS) as FileKind[]).map((k) => ({
                value: k,
                label: KIND_LABELS[k],
              })),
            ]}
          />
          <Select
            size="sm"
            value={storage}
            onValueChange={setStorage}
            options={[
              { value: "all", label: "All storage" },
              { value: "local", label: "Local PC" },
              { value: "gdrive", label: "Google Drive" },
              { value: "archintel", label: "ArchIntel" },
            ]}
          />
          <Select
            size="sm"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "all", label: "All status" },
              { value: "draft", label: "Draft" },
              { value: "shared", label: "Shared" },
              { value: "approved", label: "Approved" },
              { value: "superseded", label: "Superseded" },
              { value: "archived", label: "Archived" },
            ]}
          />
        </div>
      </div>

      {/* ---- table ---- */}
      <div className="mt-5">
        {isLoading ? (
          <Card className="p-4">
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileText}
              title={hasFilters ? "No files match" : "No files yet"}
              description={
                hasFilters
                  ? "Try clearing a filter or search term to widen the view."
                  : "Files uploaded against a project will appear in this register."
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
          <Card className="overflow-hidden">
            <Table>
              <THead>
                <TR>
                  <TH>File</TH>
                  <TH>Project</TH>
                  <TH>Kind</TH>
                  <TH>Owner</TH>
                  <TH>Storage</TH>
                  <TH className="text-right">Version</TH>
                  <TH>Uploaded</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((f) => {
                  const proj = projectById(f.projectId);
                  const owner = memberById(f.ownerId);
                  const isLocal = f.storage === "local";
                  const isHome = f.storage === "archintel";
                  const justMoved = moved[f.id];
                  return (
                    <TR
                      key={f.id}
                      className={cn(
                        isLocal && "bg-ochre-tint/30 hover:bg-ochre-tint/50",
                      )}
                    >
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-paper-2 text-[10px] font-semibold text-ink-faint">
                            {f.ext}
                          </span>
                          <span className="font-medium text-ink">{f.name}</span>
                        </div>
                      </TD>
                      <TD>
                        {proj ? (
                          <Link
                            to={`/projects/${proj.id}`}
                            className="text-blue hover:underline"
                          >
                            {proj.code}
                          </Link>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </TD>
                      <TD className="text-ink-soft">{KIND_LABELS[f.kind]}</TD>
                      <TD className="text-ink-soft">
                        {owner ? owner.name.split(" ")[0] : "—"}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1.5">
                          <StorageChip storage={f.storage} />
                          {isLocal && (
                            <Tooltip content="Lives on one person's machine — a continuity risk">
                              <HardDrive className="h-3.5 w-3.5 text-ochre" />
                            </Tooltip>
                          )}
                        </div>
                      </TD>
                      <TD className="text-right tnum text-ink-soft">{f.version}</TD>
                      <TD className="text-ink-soft">{shortDate(f.uploadedDate)}</TD>
                      <TD>
                        <FileStatusBadge status={f.status} />
                      </TD>
                      <TD className="text-right">
                        {justMoved ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-sage">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Moved
                          </span>
                        ) : (
                          <Dropdown>
                            <DropdownTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                              >
                                Actions
                              </Button>
                            </DropdownTrigger>
                            <DropdownContent>
                              <DropdownItem
                                onSelect={() =>
                                  flash(`Opening ${f.name} (${f.ext}) — prototype`)
                                }
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open file
                              </DropdownItem>
                              <DropdownItem
                                disabled={isHome}
                                onSelect={() => !isHome && moveToArchintel(f)}
                                className={cn(isHome && "opacity-40")}
                              >
                                <FolderUp className="h-3.5 w-3.5" />
                                {isHome ? "Already in ArchIntel" : "Move to ArchIntel"}
                              </DropdownItem>
                            </DropdownContent>
                          </Dropdown>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="mt-4 text-xs text-ink-ghost">
          Showing {filtered.length} of {files.length} file{files.length === 1 ? "" : "s"}
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

      {/* ---- inline success toast ---- */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2.5 rounded-lg border border-line bg-ink px-4 py-2.5 text-sm text-paper shadow-pop animate-rise">
          <CheckCircle2 className="h-4 w-4 text-sage" />
          <span>{toast}</span>
          <button
            className="ml-1 rounded p-0.5 text-paper/60 hover:text-paper"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </Page>
  );
}
