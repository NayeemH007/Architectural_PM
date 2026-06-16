import { useState } from "react";
import { Sparkles, FileText, Check, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { Card, CardContent, CardFooter, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfidenceBadge, DataCompleteness } from "@/components/trust";
import { SourceChip } from "@/components/data-source";
import { InsufficientData } from "@/components/states";
import { shortDate, relative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAIReports } from "@/lib/api";
import { aiReports, reportById } from "@/lib/mock/insights";
import { projectById } from "@/lib/mock/data";
import type { AIReport, AIReportBlock, AIReportKind } from "@/lib/types";

// kind → label + badge tone. Keeps the document language consistent with the
// rest of Space Esse: a report is a named artefact, not a generic "AI output".
const KIND_META: Record<AIReportKind, { label: string; tone: "blue" | "sage" | "ochre" | "sienna" | "rust" | "neutral" }> = {
  daily_brief: { label: "Daily brief", tone: "blue" },
  weekly_project: { label: "Weekly project", tone: "sage" },
  monthly_company: { label: "Monthly company", tone: "neutral" },
  risk_summary: { label: "Risk summary", tone: "ochre" },
  cash_warning: { label: "Cash warning", tone: "rust" },
};

const STATUS_META: Record<AIReport["status"], { label: string; tone: "ochre" | "sage" | "neutral" }> = {
  needs_review: { label: "Needs review", tone: "ochre" },
  published: { label: "Published", tone: "sage" },
  draft: { label: "Draft", tone: "neutral" },
};

const KIND_ORDER: AIReportKind[] = [
  "daily_brief",
  "weekly_project",
  "monthly_company",
  "risk_summary",
  "cash_warning",
];

/** A single selectable report in the left rail. */
function ReportListCard({
  report,
  selected,
  onSelect,
}: {
  report: AIReport;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = KIND_META[report.kind];
  const status = STATUS_META[report.status];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cn(
        "w-full rounded-lg border bg-paper px-4 py-3 text-left transition-all",
        selected
          ? "border-blue/40 bg-blue-ghost shadow-card ring-1 ring-blue/20"
          : "border-line hover:border-ink-ghost hover:bg-paper-2",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={kind.tone} size="sm" dot>
          {kind.label}
        </Badge>
        <Badge tone={status.tone} size="sm">
          {status.label}
        </Badge>
      </div>
      <div className="mt-2 font-display text-[15px] leading-snug text-ink">{report.title}</div>
      <div className="mt-1 text-xs text-ink-faint">Generated {relative(report.generatedAt)}</div>
      <div className="mt-2.5">
        <DataCompleteness value={report.completeness} />
      </div>
    </button>
  );
}

/** One narrative block, with its cited facts and a confidence reading. */
function ReportBlock({ block }: { block: AIReportBlock }) {
  if (block.insufficient) {
    return (
      <div className="border-t border-line pt-5">
        <h3 className="font-display text-lg text-ink">{block.heading}</h3>
        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">{block.body}</p>
        <div className="mt-3">
          <InsufficientData
            metric={block.heading}
            hint="four of eight projects have timesheet coverage below 65%, so labour cost is incomplete."
          />
        </div>
      </div>
    );
  }
  return (
    <div className="border-t border-line pt-5">
      <h3 className="font-display text-lg text-ink">{block.heading}</h3>
      <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{block.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <ConfidenceBadge level={block.confidence} className="mr-1" />
        {block.citations.length === 0 ? (
          <span className="text-[11px] italic text-ink-ghost">No source records cited.</span>
        ) : (
          block.citations.map((c, i) => (
            <SourceChip key={i} name={`${c.sourceName} · ${c.ref}`} />
          ))
        )}
      </div>
    </div>
  );
}

/** The right-hand document reader — the published artefact for the selected report. */
function ReportReader({ report }: { report: AIReport }) {
  const kind = KIND_META[report.kind];
  const status = STATUS_META[report.status];
  const project = report.projectId ? projectById(report.projectId) : null;
  const externalReview = report.audience === "external" && report.status === "needs_review";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-col items-stretch gap-4 border-b border-line bg-paper-2/60 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={kind.tone} dot>
            {kind.label}
          </Badge>
          <Badge tone={report.audience === "external" ? "sienna" : "neutral"} size="sm">
            {report.audience === "external" ? "Client-facing" : "Internal"}
          </Badge>
          <Badge tone={status.tone} size="sm">
            {status.label}
          </Badge>
        </div>
        <div>
          <CardTitle className="text-[22px]">{report.title}</CardTitle>
          <p className="mt-1 text-sm text-ink-faint">
            Generated {shortDate(report.generatedAt)}
            {project ? ` · ${project.name}` : " · Firm-wide"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DataCompleteness value={report.completeness} />
          <div className="flex items-center gap-2">
            {externalReview ? (
              <>
                <Button variant="primary" size="sm">
                  <Check className="h-4 w-4" /> Approve &amp; send
                </Button>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" /> Regenerate
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4" /> Regenerate
                </Button>
                <Button variant="outline" size="sm">
                  <Send className="h-4 w-4" /> Export
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        {/* Highlighted intro — the human-readable thesis of the report. */}
        <div className="rounded-md border border-blue/15 bg-blue-ghost px-4 py-3.5">
          <div className="label-draft mb-1 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue" /> Summary
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{report.summary}</p>
        </div>

        <div className="mt-6 space-y-5">
          {report.blocks.map((block, i) => (
            <ReportBlock key={i} block={block} />
          ))}
        </div>
      </CardContent>

      <CardFooter className="bg-paper-2/40 text-[11px] text-ink-ghost">
        <span>
          Every figure traces to a cited record. The narrative is generated; the numbers are not.
        </span>
        <span className="tnum">{report.blocks.length} sections</span>
      </CardFooter>
    </Card>
  );
}

export function AIReports() {
  const { data: reports = [], isLoading } = useAIReports();

  // Default selection: the daily brief (the owner's morning artefact), falling
  // back to the first report. Mock fallback keeps the reader populated before
  // the query resolves, so the page never flashes empty.
  const defaultId = aiReports.find((r) => r.kind === "daily_brief")?.id ?? aiReports[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(defaultId);

  const list = reports.length ? reports : aiReports;
  const selected = list.find((r) => r.id === selectedId) ?? reportById(selectedId) ?? list[0];

  return (
    <Page>
      <PageHeader
        kicker="Intelligence"
        title="AI reports & briefings"
        description="Every figure cites the source record, the date it was observed and a confidence level. The AI writes the narrative around verified facts — and refuses when the data is missing."
        actions={
          <Button variant="primary" size="md">
            <Sparkles className="h-4 w-4" /> New report
          </Button>
        }
      />

      {/* Anti-hallucination explainer — the trust contract, stated plainly. */}
      <Card className="mt-6 border-blue/20 bg-blue-tint">
        <div className="flex items-start gap-3 px-5 py-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue text-paper">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display text-[15px] text-ink">How these reports stay honest</div>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-soft">
              Space Esse computes every number deterministically from verified records. The AI only writes the
              narrative around cited facts — and refuses when data is missing, showing a refusal rather than a
              fabricated figure.
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* LEFT — selectable report library */}
        <div>
          <div className="label-draft mb-2.5 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Report library ({list.length})
          </div>
          {isLoading && reports.length === 0 ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((report) => (
                <ReportListCard
                  key={report.id}
                  report={report}
                  selected={report.id === selected?.id}
                  onSelect={() => setSelectedId(report.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT — the selected report, rendered as a document */}
        <div className="min-w-0">
          {selected ? (
            <ReportReader report={selected} />
          ) : (
            <Skeleton className="h-[420px] rounded-lg" />
          )}
        </div>
      </div>

      {/* Report types footer — the full catalogue Space Esse can author. */}
      <PageSection
        className="mt-10"
        title="Report types"
        description="Space Esse authors five briefing formats — each cited, dated and confidence-rated."
      >
        <div className="flex flex-wrap gap-2">
          {KIND_ORDER.map((k) => (
            <Badge key={k} tone={KIND_META[k].tone} dot>
              {KIND_META[k].label}
            </Badge>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-ink-ghost">
          The AI never invents a number. When records are insufficient, it says so — by name and section.
        </p>
      </PageSection>
    </Page>
  );
}

export default AIReports;
