import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  X,
  ShieldCheck,
  FileText,
  GitMerge,
  AlertTriangle,
  PencilLine,
} from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardHeader,
  CardKicker,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceBadge } from "@/components/trust";
import { SourceChip } from "@/components/data-source";
import { EmptyState } from "@/components/states";
import { relative, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useReviewQueue } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { ReviewItem, ReviewKind } from "@/lib/mock/ops";

// ---- kind presentation -------------------------------------------------------
const KIND_META: Record<
  ReviewKind,
  { label: string; tone: "blue" | "sage" | "ochre" | "rust"; icon: typeof FileText }
> = {
  report: { label: "AI report", tone: "blue", icon: FileText },
  capture: { label: "Capture", tone: "sage", icon: PencilLine },
  match: { label: "Project match", tone: "ochre", icon: GitMerge },
  discrepancy: { label: "Discrepancy", tone: "rust", icon: AlertTriangle },
};

const KIND_FILTER = [
  { value: "all", label: "All kinds" },
  { value: "report", label: "AI reports" },
  { value: "capture", label: "Captures" },
  { value: "discrepancy", label: "Discrepancies" },
  { value: "match", label: "Project matches" },
];

// ---- per-item review row -----------------------------------------------------
function ReviewRow({
  item,
  onResolve,
}: {
  item: ReviewItem;
  onResolve: (id: string, status: "approved" | "rejected") => void;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;
  const project = item.projectId ? projectById(item.projectId) : undefined;
  const resolved = item.status !== "pending";
  const isReport = item.kind === "report";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between",
        resolved && "opacity-65",
      )}
    >
      <div className="flex min-w-0 gap-3">
        <span
          className={cn(
            "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md",
            meta.tone === "blue" && "bg-blue-tint text-blue",
            meta.tone === "sage" && "bg-sage-tint text-sage",
            meta.tone === "ochre" && "bg-ochre-tint text-ochre",
            meta.tone === "rust" && "bg-rust-tint text-rust",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone} size="sm">
              {meta.label}
            </Badge>
            <h4 className="text-sm font-medium text-ink">{item.title}</h4>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">{item.detail}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11px] text-ink-faint">
            {project && (
              <Link
                to={`/projects/${item.projectId}`}
                className="font-medium text-blue hover:underline"
              >
                {project.name}
              </Link>
            )}
            {project && <span className="text-ink-ghost">·</span>}
            <span className="text-ink-soft">{item.submittedBy}</span>
            <span className="text-ink-ghost">{relative(item.submittedAt)}</span>
            <span className="text-ink-ghost">·</span>
            <ConfidenceBadge level={item.confidence} />
            <SourceChip name={`${item.source.sourceName} · ${item.source.recordRef}`} />
          </div>
        </div>
      </div>

      {/* actions / resolved state */}
      <div className="flex shrink-0 items-center gap-2 self-start sm:pl-3">
        {resolved ? (
          item.status === "approved" ? (
            <Badge tone="sage" size="sm" dot>
              {isReport ? "Signed off" : "Verified"}
            </Badge>
          ) : (
            <Badge tone="rust" size="sm" dot>
              Rejected
            </Badge>
          )
        ) : (
          <>
            <Button
              variant={isReport ? "primary" : "sienna"}
              size="sm"
              onClick={() => onResolve(item.id, "approved")}
            >
              {isReport ? (
                <>
                  <ShieldCheck className="h-4 w-4" /> Approve &amp; send
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Verify &amp; promote
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-rust hover:bg-rust-tint hover:text-rust"
              onClick={() => onResolve(item.id, "rejected")}
            >
              <X className="h-4 w-4" /> Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ---- loading skeleton --------------------------------------------------------
function QueueSkeleton() {
  return (
    <div className="divide-y divide-line">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-start gap-3 px-5 py-4">
          <Skeleton className="h-8 w-8 shrink-0 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-28 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// ---- the page ----------------------------------------------------------------
export default function Review() {
  const { data, isLoading } = useReviewQueue();

  // seed a local, mutable copy so approve/reject is interactive
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [seeded, setSeeded] = useState(false);
  if (!seeded && data) {
    setItems(data);
    setSeeded(true);
  }

  const [kindFilter, setKindFilter] = useState<string>("all");
  const [tab, setTab] = useState<"pending" | "resolved">("pending");

  function resolveItem(id: string, status: "approved" | "rejected") {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status } : it)));
  }

  // ---- derived stats (always over the canonical list) ----
  const stats = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending");
    return {
      pending: pending.length,
      reports: pending.filter((i) => i.kind === "report").length,
      captures: pending.filter((i) => i.kind === "capture" || i.kind === "match").length,
      discrepancies: pending.filter((i) => i.kind === "discrepancy").length,
    };
  }, [items]);

  // ---- filtered views ----
  const byKind = useMemo(
    () => (kindFilter === "all" ? items : items.filter((i) => i.kind === kindFilter)),
    [items, kindFilter],
  );
  const pending = useMemo(() => byKind.filter((i) => i.status === "pending"), [byKind]);
  const resolved = useMemo(() => byKind.filter((i) => i.status !== "pending"), [byKind]);

  const loading = isLoading || !seeded;

  return (
    <Page>
      <PageHeader
        kicker="Intelligence"
        title="Review queue"
        description="Verify captured records and approve client-facing AI reports before they're sent — every item shows its source and confidence."
        actions={
          <Badge tone="ink" size="md">
            <ShieldCheck className="h-3.5 w-3.5" /> Maker–checker
          </Badge>
        }
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-7 w-12" />
            </Card>
          ))
        ) : (
          <>
            <KpiCard
              kicker="Pending review"
              value={stats.pending}
              footnote={<span className="text-[11px] text-ink-ghost">Awaiting a human check</span>}
            />
            <KpiCard
              kicker="Reports awaiting sign-off"
              value={stats.reports}
              footnote={
                stats.reports > 0 ? (
                  <Badge tone="blue" size="sm">
                    Client-facing
                  </Badge>
                ) : (
                  <span className="text-[11px] text-sage">All cleared</span>
                )
              }
            />
            <KpiCard
              kicker="Captures to verify"
              value={stats.captures}
              footnote={<span className="text-[11px] text-ink-ghost">Notes &amp; matches</span>}
            />
            <KpiCard
              kicker="Discrepancies"
              value={stats.discrepancies}
              footnote={
                stats.discrepancies > 0 ? (
                  <span className="text-[11px] text-rust">Conflicting sources</span>
                ) : (
                  <span className="text-[11px] text-sage">None open</span>
                )
              }
            />
          </>
        )}
      </div>

      {/* queue + explainer */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "resolved")}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="pending">
                  Pending{!loading && pending.length > 0 ? ` (${pending.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="resolved">
                  Resolved{!loading && resolved.length > 0 ? ` (${resolved.length})` : ""}
                </TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-ink-faint">Filter</span>
                <Select
                  value={kindFilter}
                  onValueChange={setKindFilter}
                  options={KIND_FILTER}
                  size="sm"
                  className="w-40"
                />
              </div>
            </div>

            <TabsContent value="pending" className="!mt-0">
              <Card>
                {loading ? (
                  <QueueSkeleton />
                ) : pending.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="Queue is clear"
                    description="Nothing is waiting on a human. New captures, AI reports, matches and flagged discrepancies will land here for sign-off."
                  />
                ) : (
                  <div className="divide-y divide-line">
                    {pending.map((item) => (
                      <ReviewRow key={item.id} item={item} onResolve={resolveItem} />
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="resolved" className="!mt-0">
              <Card>
                {loading ? (
                  <QueueSkeleton />
                ) : resolved.length === 0 ? (
                  <EmptyState
                    icon={Check}
                    title="Nothing resolved yet"
                    description="Approved and rejected items move here, keeping an auditable trail of every decision."
                  />
                ) : (
                  <div className="divide-y divide-line">
                    {resolved.map((item) => (
                      <ReviewRow key={item.id} item={item} onResolve={resolveItem} />
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* explainer */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardKicker>Why this gate exists</CardKicker>
                <CardTitle>The trust control</CardTitle>
              </div>
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-blue-tint text-blue">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] leading-relaxed text-ink-soft">
              <p>
                External reports are gated here before they ever reach a client. Nothing
                client-facing leaves Space Esse without an owner's sign-off.
              </p>
              <p className="text-ink">
                Captured WhatsApp threads and phone notes become citable records only after a
                human confirms them — this is the anti-hallucination and trust control at the
                centre of the system.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-line bg-paper-2 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-ochre" />
                <span className="text-[12px] text-ink-soft">
                  Confidence and source travel with every item — you approve evidence, not guesses.
                </span>
              </div>
            </CardContent>
            <CardFooter>
              <span className="text-[11px] text-ink-faint">Maker proposes · checker approves</span>
              <Badge tone="neutral" size="sm">
                Owner / Director
              </Badge>
            </CardFooter>
          </Card>

          <PageSection
            title="What lands here"
            description="Four kinds of work that always need a human."
          >
            <Card>
              <CardContent className="space-y-3 pt-4">
                {(["report", "capture", "match", "discrepancy"] as ReviewKind[]).map((k) => {
                  const m = KIND_META[k];
                  const Icon = m.icon;
                  return (
                    <div key={k} className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded",
                          m.tone === "blue" && "bg-blue-tint text-blue",
                          m.tone === "sage" && "bg-sage-tint text-sage",
                          m.tone === "ochre" && "bg-ochre-tint text-ochre",
                          m.tone === "rust" && "bg-rust-tint text-rust",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <div className="text-[13px] font-medium text-ink">{m.label}</div>
                        <p className="text-[12px] leading-snug text-ink-faint">
                          {k === "report" && "Client-facing narrative — sign off before sending."}
                          {k === "capture" && "A note or thread promoted to a citable record."}
                          {k === "match" && "A proposed link between an alias and a project."}
                          {k === "discrepancy" && "Two sources disagree — pick the truth."}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
              <CardFooter>
                <span className="text-[11px] text-ink-ghost">
                  As of {shortDate("2026-06-17")}
                </span>
                <SourceChip name="Review queue" status="manual" />
              </CardFooter>
            </Card>
          </PageSection>
        </div>
      </div>
    </Page>
  );
}
