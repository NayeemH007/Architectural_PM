import { useEffect, useRef, useState } from "react";
import * as RD from "@radix-ui/react-dialog";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { ConfidenceBadge } from "@/components/trust";
import { SourceChip } from "@/components/data-source";
import type { Confidence } from "@/lib/types";

interface Answer {
  q: string;
  body: string;
  confidence: Confidence;
  citations: { name: string; date: string }[];
  insufficient?: boolean;
}

const SUGGESTED = [
  "Which projects are losing money?",
  "What's overdue in collections right now?",
  "Where are we stuck on authority approvals?",
  "Can we take on a new project next month?",
  "Who is overloaded this week?",
];

const ANSWERS: Record<string, Answer> = {
  "Which projects are losing money?": {
    q: "Which projects are losing money?",
    body: "One project is clearly at risk: Meghna Textiles HQ Interior. Its cost-to-date (৳46.5L) has already passed the planned budget (৳42.0L), and unbilled change orders of ~৳1.4L were captured from WhatsApp on 9 Jun. Forecast margin is ~4% — but low-confidence, because timesheet coverage on this project is only 60%. Aldenair and Cantonment are still positive on a fee basis.",
    confidence: "low",
    citations: [
      { name: "Manual capture · Change log", date: "2026-06-09" },
      { name: "TallyPrime · cost-to-date", date: "2026-06-12" },
    ],
  },
  "What's overdue in collections right now?": {
    q: "What's overdue in collections right now?",
    body: "৳58.0L is overdue across three invoices. ৳39.0L of it is Meghna Textiles (INV-2026-019 at 97 days, INV-2026-022 at 51 days) and ৳18.0L is Aldenair (INV-2026-028 at 46 days). After VAT, VDS and ~10% AIT withholding, net cash at risk is about ৳49L.",
    confidence: "high",
    citations: [
      { name: "TallyPrime · INV-2026-019", date: "2026-06-12" },
      { name: "TallyPrime · INV-2026-028", date: "2026-06-12" },
    ],
  },
  "Where are we stuck on authority approvals?": {
    q: "Where are we stuck on authority approvals?",
    body: "Bashati Corporate Tower is the blocker. Its RAJUK Construction Permit (Form 301) has been in review 61 days versus the 30-day statutory window, and it blocks construction start — it has capped the project's health score at 49. FSCD also raised a query on the refuge floor; resubmission is targeted for 20 Jun (captured via phone note, not yet promoted to a verified record).",
    confidence: "high",
    citations: [
      { name: "RAJUK ECPS · ECPS-2024-88213", date: "2026-06-12" },
      { name: "Phone note · Decision #219", date: "2026-06-09" },
    ],
  },
  "Can we take on a new project next month?": {
    q: "Can we take on a new project next month?",
    body: "I can't answer this with confidence. Capacity depends on billable utilization, and only 6 of 10 staff log time — firm timesheet coverage is 64% this week. I won't estimate spare capacity from incomplete data. What I can say: Arif Chowdhury has been above 90% for six weeks (overloaded), while Nusrat Jahan trended down to 71%. Improve timesheet coverage to unlock a reliable capacity answer.",
    confidence: "insufficient",
    insufficient: true,
    citations: [{ name: "Timesheet capture · coverage 64%", date: "2026-06-15" }],
  },
  "Who is overloaded this week?": {
    q: "Who is overloaded this week?",
    body: "Arif Chowdhury is the clear signal — billable utilization above 90% for six consecutive weeks (high confidence, 92% timesheet coverage). Kamrul Pasha is also high at ~90%. Several others can't be assessed: the principal, finance and the liaison don't log time, so their load is unknown rather than low.",
    confidence: "medium",
    citations: [{ name: "Timesheet capture · series e3", date: "2026-06-15" }],
  },
};

function genericAnswer(q: string): Answer {
  return {
    q,
    body: "I answer from verified records only. I don't have enough linked data to answer that confidently yet. Try one of the suggested questions, or capture the underlying records first — I'll show my sources and confidence on every answer.",
    confidence: "insufficient",
    insufficient: true,
    citations: [],
  };
}

export function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [input, setInput] = useState("");
  const [thread, setThread] = useState<Answer[]>([]);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread, thinking]);

  function ask(q: string) {
    if (!q.trim()) return;
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const a = ANSWERS[q] ?? genericAnswer(q);
      setThread((t) => [...t, a]);
      setThinking(false);
    }, 650);
  }

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-rise" />
        <RD.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-bone shadow-pop outline-none data-[state=open]:animate-rise">
          <div className="flex items-center justify-between border-b border-line bg-paper px-5 py-3.5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-blue text-paper">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-[15px] text-ink">Ask Space Esse</div>
                <div className="text-[11px] text-ink-faint">Cited answers · refuses when data is missing</div>
              </div>
            </div>
            <RD.Close className="rounded-md p-1.5 text-ink-faint hover:bg-bone-2">
              <X className="h-4 w-4" />
            </RD.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {thread.length === 0 && !thinking && (
              <div className="mt-4">
                <p className="text-sm text-ink-soft">
                  Ask about money, delivery, approvals or people. Every answer cites the source records and shows a
                  confidence level.
                </p>
                <div className="mt-4 space-y-1.5">
                  <div className="label-draft">Try</div>
                  {SUGGESTED.map((q) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      className="block w-full rounded-md border border-line bg-paper px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:border-blue/40 hover:text-ink"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-5">
              {thread.map((a, i) => (
                <div key={i} className="space-y-2">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-blue px-3.5 py-2 text-sm text-paper">
                    {a.q}
                  </div>
                  <div
                    className={cn(
                      "rounded-2xl rounded-bl-sm border bg-paper px-3.5 py-3",
                      a.insufficient ? "border-dashed border-line-strong" : "border-line",
                    )}
                  >
                    <p className="text-[13px] leading-relaxed text-ink">{a.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
                      <ConfidenceBadge level={a.confidence} />
                      {a.citations.map((c, j) => (
                        <SourceChip key={j} name={`${c.name}`} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-1.5 text-sm text-ink-faint">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue [animation-delay:300ms]" />
                  <span className="ml-1">Checking the records…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className="border-t border-line bg-paper p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex items-center gap-2 rounded-lg border border-line-strong bg-bone px-2 py-1.5 focus-within:border-blue"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your practice…"
                className="flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-ghost"
              />
              <button
                type="submit"
                className="grid h-7 w-7 place-items-center rounded-md bg-blue text-paper disabled:opacity-40"
                disabled={!input.trim()}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-1.5 px-1 text-[11px] text-ink-ghost">
              Space Esse only uses verified records. It will say when it doesn't know.
            </p>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
