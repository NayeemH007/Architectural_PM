import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as RD from "@radix-ui/react-dialog";
import { ArrowUp, Radar, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAiRisks } from "@/lib/archintel/api";
import { RISK_ANSWERS, RISK_SUGGESTIONS, genericRiskAnswer, type AIAnswer } from "@/lib/archintel/intelligence";

const SEV: Record<string, { dot: string; text: string }> = {
  critical: { dot: "bg-rust", text: "text-rust" },
  high: { dot: "bg-sienna", text: "text-sienna" },
  medium: { dot: "bg-ochre", text: "text-ochre" },
  low: { dot: "bg-blue", text: "text-blue" },
};

export function AssistantPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: risks = [] } = useAiRisks();
  const [input, setInput] = useState("");
  const [thread, setThread] = useState<AIAnswer[]>([]);
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
      setThread((t) => [...t, RISK_ANSWERS[q] ?? genericRiskAnswer(q)]);
      setThinking(false);
    }, 600);
  }

  const top = [...risks].sort((a, b) => b.likelihood - a.likelihood).slice(0, 3);

  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-[2px] data-[state=open]:animate-rise" />
        <RD.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-bone shadow-pop outline-none data-[state=open]:animate-rise">
          <div className="flex items-center justify-between border-b border-line bg-paper px-5 py-3.5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-md bg-blue text-paper">
                <Radar className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-[15px] text-ink">ArchIntel AI · Risk Radar</div>
                <div className="text-[11px] text-ink-faint">Spots risks early · learns your studio over time</div>
              </div>
            </div>
            <RD.Close className="rounded-md p-1.5 text-ink-faint hover:bg-bone-2">
              <X className="h-4 w-4" />
            </RD.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {thread.length === 0 && !thinking && (
              <>
                <div className="label-draft mb-2">Flagged now</div>
                <div className="space-y-2">
                  {top.map((r) => (
                    <div key={r.id} className="rounded-lg border border-line bg-paper p-3">
                      <div className="flex items-start gap-2">
                        <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", SEV[r.severity].dot)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-ink">{r.title}</span>
                            <span className={cn("shrink-0 text-[11px] font-medium tnum", SEV[r.severity].text)}>{r.likelihood}%</span>
                          </div>
                          <p className="mt-1 text-xs leading-snug text-ink-soft">{r.recommendedAction}</p>
                          {r.projectId && (
                            <Link to={`/projects/${r.projectId}`} onClick={() => onOpenChange(false)} className="mt-1 inline-block text-[11px] font-medium text-blue hover:underline">
                              Open project →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Link to="/intelligence" onClick={() => onOpenChange(false)} className="mt-3 inline-block text-xs font-medium text-blue hover:underline">
                  See the full Risk Radar →
                </Link>

                <div className="mt-5 space-y-1.5">
                  <div className="label-draft">Ask ArchIntel</div>
                  {RISK_SUGGESTIONS.map((q) => (
                    <button key={q} onClick={() => ask(q)} className="block w-full rounded-md border border-line bg-paper px-3 py-2 text-left text-sm text-ink-soft transition-colors hover:border-blue/40 hover:text-ink">
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="space-y-5">
              {thread.map((a, i) => (
                <div key={i} className="space-y-2">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-blue px-3.5 py-2 text-sm text-paper">{a.q}</div>
                  <div className="rounded-2xl rounded-bl-sm border border-line bg-paper px-3.5 py-3">
                    <p className="text-[13px] leading-relaxed text-ink">{a.body}</p>
                    {a.refs.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-line pt-2.5">
                        {a.refs.map((r, j) => (
                          <span key={j} className="rounded border border-line bg-paper-2 px-1.5 py-0.5 text-[11px] text-ink-soft">{r}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-1.5 text-sm text-ink-faint">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue [animation-delay:300ms]" />
                  <span className="ml-1">Checking your studio…</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>

          <div className="border-t border-line bg-paper p-3">
            <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 rounded-lg border border-line-strong bg-bone px-2 py-1.5 focus-within:border-blue">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about risk, money, or a project…" className="flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-ghost" />
              <button type="submit" disabled={!input.trim()} className="grid h-7 w-7 place-items-center rounded-md bg-blue text-paper disabled:opacity-40">
                <ArrowUp className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-1.5 px-1 text-[11px] text-ink-ghost">A preview of ArchIntel's risk model. Real learning improves as your studio uses it.</p>
          </div>
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
