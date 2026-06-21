import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Radar,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Eye,
  ShieldCheck,
  Lightbulb,
  TrendingUp,
  Layers,
  Wallet,
  User2,
  Clock3,
  Info,
  MessageSquare,
  CornerDownRight,
} from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  useAiRisks,
  useAiStageRisk,
  useAiInsights,
  useAiPayments,
} from "@/lib/archintel/api";
import { projectById } from "@/lib/archintel/data";
import { RISK_SUGGESTIONS } from "@/lib/archintel/intelligence";
import type {
  PredictedRisk,
  RiskSeverity,
  RiskInsight,
} from "@/lib/archintel/intelligence";
import { bdt, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";

// ---- severity styling ----
const SEV_TONE: Record<RiskSeverity, "rust" | "sienna" | "ochre" | "blue"> = {
  critical: "rust",
  high: "sienna",
  medium: "ochre",
  low: "blue",
};
const SEV_DOT: Record<RiskSeverity, string> = {
  critical: "bg-rust",
  high: "bg-sienna",
  medium: "bg-ochre",
  low: "bg-blue",
};
const SEV_BORDER: Record<RiskSeverity, string> = {
  critical: "border-l-rust",
  high: "border-l-sienna",
  medium: "border-l-ochre",
  low: "border-l-blue",
};
const SEV_TEXT: Record<RiskSeverity, string> = {
  critical: "text-rust",
  high: "text-sienna",
  medium: "text-ochre",
  low: "text-blue",
};

// stage-risk bar colour scale
function riskColour(index: number) {
  if (index >= 75) return "bg-rust";
  if (index >= 55) return "bg-sienna";
  if (index >= 35) return "bg-ochre";
  return "bg-sage";
}

// insight icon by kind
const INSIGHT_ICON: Record<RiskInsight["kind"], typeof Layers> = {
  stage: Layers,
  bottleneck: ShieldCheck,
  payment: Wallet,
  person: User2,
  timing: Clock3,
};
const INSIGHT_KICKER: Record<RiskInsight["kind"], string> = {
  stage: "Stage pattern",
  bottleneck: "Bottleneck",
  payment: "Payment timing",
  person: "Team pattern",
  timing: "Timing",
};

type RiskState = "open" | "watching" | "mitigated";

export default function Intelligence() {
  const { data: risks, isLoading: loadingRisks } = useAiRisks();
  const { data: stages, isLoading: loadingStages } = useAiStageRisk();
  const { data: insights, isLoading: loadingInsights } = useAiInsights();
  const { data: payments } = useAiPayments();

  // local interactive state: per-risk Watching / Mitigate (visual only)
  const [riskState, setRiskState] = useState<Record<string, RiskState>>({});
  const [assistantOpen, setAssistantOpen] = useState(false);

  const setState = (id: string, next: RiskState) =>
    setRiskState((s) => ({ ...s, [id]: s[id] === next ? "open" : next }));

  const sortedRisks = useMemo(() => {
    return [...(risks ?? [])].sort((a, b) => b.likelihood - a.likelihood);
  }, [risks]);

  // ---- KPI derivations ----
  const openCount = useMemo(
    () =>
      sortedRisks.filter((r) => (riskState[r.id] ?? "open") !== "mitigated")
        .length,
    [sortedRisks, riskState],
  );
  const critHighCount = useMemo(
    () =>
      sortedRisks.filter(
        (r) =>
          (r.severity === "critical" || r.severity === "high") &&
          (riskState[r.id] ?? "open") !== "mitigated",
      ).length,
    [sortedRisks, riskState],
  );
  const moneyAtRisk = useMemo(
    () =>
      (payments ?? [])
        .filter((p) => p.status === "overdue")
        .reduce((s, p) => s + (p.amount - p.receivedAmount), 0),
    [payments],
  );
  const approvalBottleneck = useMemo(
    () =>
      sortedRisks.some(
        (r) =>
          r.stage.toLowerCase().includes("studio") ||
          r.title.toLowerCase().includes("bottleneck"),
      ),
    [sortedRisks],
  );

  return (
    <Page>
      <PageHeader
        kicker="Studio Intelligence"
        title="Risk Radar"
        description="ArchIntel watches every active project for the patterns that stall studios — converging approvals, overdue payments, runaway revision loops — and flags them before they become a problem. It sharpens as SPACE ESSE logs more decisions, approvals and payments."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssistantOpen(true)}
          >
            <Sparkles className="h-4 w-4" />
            Ask the Risk assistant
          </Button>
        }
      />

      {/* ---- honest preview note ---- */}
      <Card className="mt-5 border-blue/25 bg-blue-ghost/40">
        <CardContent className="flex items-start gap-3 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue" />
          <p className="text-[13px] leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">Preview.</span> These flags
            are pattern-based on your current projects. ArchIntel sharpens as
            your studio logs more decisions, approvals and payments — the more it
            sees, the earlier it warns.
          </p>
        </CardContent>
      </Card>

      {/* ---- KPI row ---- */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loadingRisks ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              kicker="Open risks"
              value={openCount}
              footnote={
                <span className="text-xs text-ink-ghost">flagged right now</span>
              }
            />
            <KpiCard
              kicker="Critical / High"
              value={critHighCount}
              footnote={
                <span className="text-xs text-rust">need a decision soon</span>
              }
            />
            <KpiCard
              kicker="Money at risk"
              value={bdt(moneyAtRisk, { compact: true })}
              footnote={
                <Link to="/finance" className="text-xs text-blue hover:underline">
                  overdue receivables
                </Link>
              }
            />
            <KpiCard
              kicker="Approval bottleneck"
              value={approvalBottleneck ? "Yes" : "No"}
              footnote={
                <span
                  className={cn(
                    "text-xs",
                    approvalBottleneck ? "text-rust" : "text-sage",
                  )}
                >
                  {approvalBottleneck
                    ? "queue forming on one reviewer"
                    : "queue is healthy"}
                </span>
              }
            />
          </>
        )}
      </div>

      {/* ---- Flagged now ---- */}
      <PageSection
        className="mt-8"
        title="Flagged now"
        description="Ranked by likelihood — the risks ArchIntel thinks are most likely to surface."
        actions={
          <span className="hidden items-center gap-1.5 text-xs text-ink-faint sm:inline-flex">
            <Radar className="h-3.5 w-3.5 text-blue" />
            live pattern scan
          </span>
        }
      >
        {loadingRisks ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sortedRisks.map((r) => (
              <RiskCard
                key={r.id}
                risk={r}
                state={riskState[r.id] ?? "open"}
                onWatch={() => setState(r.id, "watching")}
                onMitigate={() => setState(r.id, "mitigated")}
              />
            ))}
          </div>
        )}
      </PageSection>

      {/* ---- Where risk concentrates ---- */}
      <PageSection
        className="mt-8"
        title="Where risk concentrates"
        description="A relative read on which phase tends to stall your projects."
      >
        <Card>
          <CardContent className="pt-5">
            {loadingStages ? (
              <div className="space-y-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-5">
                {(stages ?? []).map((s) => (
                  <div key={s.stage}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-ink">
                        {s.stage}
                      </span>
                      <span className="font-display text-sm text-ink tnum">
                        {s.riskIndex}
                        <span className="text-ink-faint">/100</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-bone-2">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          riskColour(s.riskIndex),
                        )}
                        style={{ width: `${s.riskIndex}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
                      {s.note}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageSection>

      {/* ---- What ArchIntel has learned ---- */}
      <PageSection
        className="mt-8"
        title="What ArchIntel has learned"
        description="Standing patterns observed across your active and archived projects."
      >
        {loadingInsights ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(insights ?? []).map((ins) => {
              const Icon = INSIGHT_ICON[ins.kind] ?? Lightbulb;
              return (
                <Card key={ins.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col pt-5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-paper-2">
                        <Icon className="h-4 w-4 text-blue" />
                      </span>
                      <span className="label-draft">
                        {INSIGHT_KICKER[ins.kind]}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-snug text-ink">
                      {ins.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                      {ins.detail}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </PageSection>

      {/* ---- assistant footer ---- */}
      <Card className="mt-8 border-blue/25 bg-gradient-to-br from-blue-ghost/50 to-paper">
        <CardContent className="flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue/10">
              <Sparkles className="h-5 w-5 text-blue" />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">
                Ask the Risk assistant
              </p>
              <p className="mt-0.5 text-[13px] text-ink-soft">
                Ask what is most likely to go wrong this week, where money is at
                risk, or who is overloaded.
              </p>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={() => setAssistantOpen(true)}>
            <MessageSquare className="h-4 w-4" />
            Open assistant
            <kbd className="ml-1 rounded border border-paper/30 bg-paper/15 px-1.5 py-0.5 text-[10px] font-medium">
              ⌘J
            </kbd>
          </Button>
        </CardContent>
      </Card>

      <AssistantDialog open={assistantOpen} onOpenChange={setAssistantOpen} />
    </Page>
  );
}

// ============================================================
// Risk card
// ============================================================
function RiskCard({
  risk,
  state,
  onWatch,
  onMitigate,
}: {
  risk: PredictedRisk;
  state: RiskState;
  onWatch: () => void;
  onMitigate: () => void;
}) {
  const proj = risk.projectId ? projectById(risk.projectId) : null;
  const mitigated = state === "mitigated";

  return (
    <Card
      className={cn(
        "flex flex-col border-l-[3px] transition-all",
        SEV_BORDER[risk.severity],
        mitigated && "opacity-60",
      )}
    >
      <CardContent className="flex flex-1 flex-col pt-5">
        {/* header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className={cn(
                "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                SEV_DOT[risk.severity],
              )}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={SEV_TONE[risk.severity]} size="sm">
                  {risk.severity}
                </Badge>
                <span className="label-draft !text-ink-faint truncate">
                  {risk.stage}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] font-medium leading-snug text-ink">
                {risk.title}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div
              className={cn(
                "font-display text-2xl leading-none tnum",
                SEV_TEXT[risk.severity],
              )}
            >
              {risk.likelihood}%
            </div>
            <div className="label-draft mt-0.5 !text-ink-faint">likely</div>
          </div>
        </div>

        {/* reasoning */}
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          {risk.reasoning}
        </p>

        {/* signals */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {risk.signals.map((sig) => (
            <span
              key={sig}
              className="inline-flex items-center rounded-md border border-line bg-paper-2 px-2 py-0.5 text-[11px] text-ink-soft"
            >
              {sig}
            </span>
          ))}
        </div>

        {/* recommended action callout */}
        <div className="mt-3 flex items-start gap-2 rounded-md border border-blue/20 bg-blue-ghost/40 px-3 py-2.5">
          <CornerDownRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue" />
          <div>
            <span className="label-draft !text-blue">Recommended</span>
            <p className="mt-0.5 text-[13px] leading-snug text-ink">
              {risk.recommendedAction}
            </p>
          </div>
        </div>

        {/* footer */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
          <div className="min-w-0 text-xs text-ink-ghost">
            <span className="text-ink-faint">Owner</span>{" "}
            <span className="text-ink-soft">{risk.owner}</span>
            {proj ? (
              <>
                {" · "}
                <Link
                  to={`/projects/${proj.id}`}
                  className="inline-flex items-center gap-0.5 text-blue hover:underline"
                >
                  {proj.code}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </>
            ) : (
              <span className="text-ink-faint"> · Studio-wide</span>
            )}
            <span className="ml-1.5 hidden text-ink-faint sm:inline">
              · seen {shortDate(risk.detectedDate)}
            </span>
          </div>
        </div>

        {/* action buttons */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            variant={state === "watching" ? "sienna" : "outline"}
            size="sm"
            className="flex-1"
            onClick={onWatch}
          >
            <Eye className="h-3.5 w-3.5" />
            {state === "watching" ? "Watching" : "Watch"}
          </Button>
          <Button
            variant={mitigated ? "subtle" : "primary"}
            size="sm"
            className="flex-1"
            onClick={onMitigate}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {mitigated ? "Mitigated" : "Mitigate"}
          </Button>
        </div>

        {mitigated && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-sage">
            <ShieldCheck className="h-3.5 w-3.5" />
            Marked as being handled — ArchIntel will keep tracking it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Risk assistant dialog (visual, canned)
// ============================================================
function AssistantDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-[18px] w-[18px] text-blue" />
            Risk assistant
          </DialogTitle>
          <DialogDescription>
            Ask about what is at risk across the studio. Preview — answers are
            drawn from the patterns ArchIntel has observed so far.
          </DialogDescription>
        </DialogHeader>
        <div className="px-5 py-4">
          <span className="label-draft">Try asking</span>
          <div className="mt-2.5 space-y-2">
            {RISK_SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-md border border-line bg-paper-2 px-3 py-2.5 text-left text-[13px] text-ink transition-colors hover:border-blue/40 hover:bg-blue-ghost/40"
              >
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-blue" />
                  {q}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              </button>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
            <Info className="h-3.5 w-3.5" />
            Open anywhere with{" "}
            <kbd className="rounded border border-line bg-paper-2 px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
              Ctrl / ⌘ + J
            </kbd>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
