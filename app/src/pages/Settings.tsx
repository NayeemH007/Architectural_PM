import { useState } from "react";
import {
  Building2,
  Users,
  Link2,
  SlidersHorizontal,
  Globe,
  ShieldCheck,
  Check,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import {
  Card,
  CardHeader,
  CardKicker,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusDot, SourceChip } from "@/components/data-source";
import { pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useEmployees, useProjects } from "@/lib/api";
import { firm, employees as employeesSeed, projects as projectsSeed } from "@/lib/mock/data";
import type { Employee, Project } from "@/lib/types";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner / Principal" },
  { value: "director", label: "Project Director" },
  { value: "architect", label: "Project Architect" },
  { value: "design_lead", label: "Design Lead" },
  { value: "finance", label: "Finance / Admin" },
  { value: "liaison", label: "Authority Liaison" },
  { value: "viewer", label: "Viewer (read-only)" },
];

// Map seed roles onto the role-select vocabulary.
function defaultRole(e: Employee): string {
  const r = e.role.toLowerCase();
  if (r.includes("owner")) return "owner";
  if (r.includes("director")) return "director";
  if (r.includes("design")) return "design_lead";
  if (r.includes("finance") || r.includes("admin")) return "finance";
  if (r.includes("liaison")) return "liaison";
  if (r.includes("architect")) return "architect";
  return "viewer";
}

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="label-draft mb-1.5">{children}</div>
);

export default function Settings() {
  const { data: employees = employeesSeed } = useEmployees();
  const { data: projects = projectsSeed } = useProjects();

  return (
    <Page>
      <PageHeader
        kicker="Administration"
        title="Settings"
        description="Owner & admin controls for Space Esse — firm profile, who sees what, how projects are matched across your tools, and where data lives."
      />

      <Tabs defaultValue="firm" className="mt-7">
        <TabsList className="flex-wrap">
          <TabsTrigger value="firm">
            <Building2 className="mr-1.5 h-4 w-4" /> Firm profile
          </TabsTrigger>
          <TabsTrigger value="users">
            <Users className="mr-1.5 h-4 w-4" /> Users & roles
          </TabsTrigger>
          <TabsTrigger value="matching">
            <Link2 className="mr-1.5 h-4 w-4" /> Project matching
          </TabsTrigger>
          <TabsTrigger value="kpis">
            <SlidersHorizontal className="mr-1.5 h-4 w-4" /> KPIs & thresholds
          </TabsTrigger>
          <TabsTrigger value="locale">
            <Globe className="mr-1.5 h-4 w-4" /> Localization & residency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="firm">
          <FirmTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab employees={employees} />
        </TabsContent>
        <TabsContent value="matching">
          <MatchingTab projects={projects} />
        </TabsContent>
        <TabsContent value="kpis">
          <KpisTab />
        </TabsContent>
        <TabsContent value="locale">
          <LocaleTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

// ---------------------------------------------------------------- Firm profile
function FirmTab() {
  const [currency, setCurrency] = useState(firm.currency);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardKicker>Identity</CardKicker>
          <CardTitle>Firm profile</CardTitle>
        </div>
        <Badge tone="blue" size="sm">{firm.staff} staff</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel>Studio name</FieldLabel>
            <Input defaultValue={firm.name} />
          </div>
          <div>
            <FieldLabel>Legal entity</FieldLabel>
            <Input defaultValue={firm.legalName} />
          </div>
          <div>
            <FieldLabel>Registered office</FieldLabel>
            <Input defaultValue={firm.office} />
          </div>
          <div>
            <FieldLabel>Established</FieldLabel>
            <Input type="number" defaultValue={firm.founded} />
          </div>
        </div>

        <Separator />

        <div>
          <CardKicker>Finance & accounting</CardKicker>
          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <FieldLabel>Base currency</FieldLabel>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as typeof firm.currency)}
                options={[
                  { value: "BDT", label: "BDT — Bangladeshi Taka (৳)" },
                  { value: "USD", label: "USD — US Dollar ($)" },
                ]}
              />
              <p className="mt-1.5 text-[11px] text-ink-faint">
                All fees, invoices and forecasts render in this currency.
              </p>
            </div>
            <div>
              <FieldLabel>Fiscal year</FieldLabel>
              <Select
                value="jul-jun"
                options={[
                  { value: "jul-jun", label: "July – June (NBR standard)" },
                  { value: "jan-dec", label: "January – December" },
                ]}
              />
              <p className="mt-1.5 text-[11px] text-ink-faint">
                Used for tax periods and annual roll-ups.
              </p>
            </div>
            <div>
              <FieldLabel>Timezone</FieldLabel>
              <Select
                value="asia-dhaka"
                options={[
                  { value: "asia-dhaka", label: "Asia/Dhaka (GMT+6)" },
                  { value: "asia-kolkata", label: "Asia/Kolkata (GMT+5:30)" },
                ]}
              />
              <p className="mt-1.5 text-[11px] text-ink-faint">Drives report timestamps & alerts.</p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <span className="text-xs text-ink-faint">{firm.tagline}</span>
        <Button variant="primary" size="sm">
          <Check className="h-3.5 w-3.5" /> Save profile
        </Button>
      </CardFooter>
    </Card>
  );
}

// --------------------------------------------------------------- Users & roles
function UsersTab({ employees }: { employees: Employee[] }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardKicker>Access control</CardKicker>
          <CardTitle>Users & roles</CardTitle>
        </div>
      </CardHeader>
      <Card className="mx-5 mb-1 flex items-center gap-3 border-ochre/30 bg-ochre-tint/40 p-3.5 shadow-none">
        <ShieldCheck className="h-5 w-5 shrink-0 text-ochre" />
        <p className="text-[13px] text-ink-soft">
          <span className="font-medium text-ink">Finance is restricted.</span> Fees, invoices and
          payments are visible only to the Owner and Finance / Admin roles. Everyone else sees
          delivery, schedule and approval data — never money. Toggle exceptions per person below.
        </p>
      </Card>
      <Table>
        <THead>
          <TR>
            <TH>Member</TH>
            <TH>Role</TH>
            <TH>Finance access</TH>
          </TR>
        </THead>
        <TBody>
          {employees.map((e) => (
            <UserRow key={e.id} e={e} />
          ))}
        </TBody>
      </Table>
      <CardFooter>
        <span className="text-xs text-ink-faint">{employees.length} members · roles sync to Space Esse permissions</span>
        <Button variant="outline" size="sm">Invite member</Button>
      </CardFooter>
    </Card>
  );
}

function UserRow({ e }: { e: Employee }) {
  const initialRole = defaultRole(e);
  const [role, setRole] = useState(initialRole);
  const financeByDefault = initialRole === "owner" || initialRole === "finance";
  return (
    <TR>
      <TD>
        <div className="flex items-center gap-3">
          <Avatar name={e.name} tone={e.avatarTone} />
          <div>
            <div className="text-sm font-medium text-ink">{e.name}</div>
            <div className="text-xs text-ink-faint">{e.title}</div>
          </div>
        </div>
      </TD>
      <TD>
        <Select size="sm" value={role} onValueChange={setRole} options={ROLE_OPTIONS} className="w-52" />
      </TD>
      <TD>
        <div className="flex items-center gap-2">
          <Switch defaultChecked={financeByDefault} />
          <span className="text-xs text-ink-faint">
            {financeByDefault ? "Full financials" : "Hidden"}
          </span>
        </div>
      </TD>
    </TR>
  );
}

// ------------------------------------------------------------- Project matching
function MatchingTab({ projects }: { projects: Project[] }) {
  const rows = projects.flatMap((p) =>
    p.crossRefs.map((x) => ({ project: p, ref: x })),
  );
  const unmatched = rows.filter((r) => !r.ref.matched).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardKicker>How it works</CardKicker>
            <CardTitle>Project cross-reference</CardTitle>
          </div>
          {unmatched > 0 && <Badge tone="ochre" size="sm">{unmatched} need review</Badge>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-soft">
            The same project is named differently in every tool — "Aldenair Lake Res." in Tally,
            "01_Aldenair_Lake" on Drive, an "ECPS" file at RAJUK. Space Esse fuzzy-matches these
            aliases to one <span className="font-medium text-ink">canonical project</span> so fees,
            drawings and approvals line up. High-confidence matches are automatic; the rest wait for
            you to confirm or re-point.
          </p>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Canonical project</TH>
              <TH>Source</TH>
              <TH>Alias in source</TH>
              <TH>Match</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(({ project, ref }) => (
              <TR key={`${project.id}-${ref.sourceId}`}>
                <TD>
                  <div className="text-sm font-medium text-ink">{project.name}</div>
                  <div className="font-mono text-[11px] text-ink-faint">{project.code}</div>
                </TD>
                <TD>
                  <SourceChip
                    name={ref.sourceName}
                    status={ref.matched ? "connected" : "manual"}
                  />
                </TD>
                <TD className="font-mono text-xs text-ink-soft">"{ref.alias}"</TD>
                <TD>
                  {ref.matched ? (
                    <Badge tone="sage" size="sm" dot>Matched</Badge>
                  ) : (
                    <Badge tone="ochre" size="sm">Unmatched</Badge>
                  )}
                </TD>
                <TD className="text-right">
                  {ref.matched ? (
                    <Button variant="ghost" size="sm">Re-match</Button>
                  ) : (
                    <Button variant="outline" size="sm">
                      <Check className="h-3.5 w-3.5" /> Confirm
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
        <CardFooter>
          <span className="flex items-center gap-2 text-xs text-ink-faint">
            <StatusDot status="connected" /> Auto-matched
            <StatusDot status="manual" /> Awaiting confirmation
          </span>
          <span className="text-xs text-ink-faint tnum">{rows.length} aliases across {projects.length} projects</span>
        </CardFooter>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------- KPIs & thresholds
const WEIGHTS = [
  { key: "budget", label: "Budget", value: 0.3 },
  { key: "schedule", label: "Schedule", value: 0.25 },
  { key: "deliverable", label: "Deliverable", value: 0.2 },
  { key: "approval", label: "Approval", value: 0.15 },
  { key: "completeness", label: "Completeness", value: 0.1 },
];

function KpisTab() {
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(WEIGHTS.map((w) => [w.key, w.value])),
  );
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  const balanced = Math.abs(sum - 1) < 0.001;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardKicker>Scoring model</CardKicker>
            <CardTitle>Project Health Score weights</CardTitle>
          </div>
          <Badge tone={balanced ? "sage" : "rust"} size="sm">
            Σ {sum.toFixed(2)}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-[13px] text-ink-soft">
            Weighted blend that produces every project's health band. Weights must sum to 1.00.
          </p>
          {WEIGHTS.map((w) => (
            <div key={w.key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-ink">{w.label}</span>
              <Input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={weights[w.key]}
                onChange={(ev) =>
                  setWeights((prev) => ({ ...prev, [w.key]: Number(ev.target.value) }))
                }
                className="w-24 text-right tnum"
              />
            </div>
          ))}
          <Separator className="my-1" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Total weight</span>
            <span className={cn("font-display text-lg tnum", balanced ? "text-sage" : "text-rust")}>
              {sum.toFixed(2)}
            </span>
          </div>
          {!balanced && (
            <p className="text-[11px] text-rust">Weights must total 1.00 before the model will save.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardKicker>Alerting</CardKicker>
            <CardTitle>Thresholds & triggers</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Overdue invoice", hint: "Flag receivables past due by", value: 30, unit: "days" },
            { label: "Approval pending", hint: "Warn when an authority approval exceeds", value: 30, unit: "days" },
            { label: "Fee-burn tolerance", hint: "Alert when cost-to-date overruns fee by", value: 10, unit: "%" },
            { label: "Utilization overload", hint: "Flag staff sustained above", value: 90, unit: "%" },
          ].map((t) => (
            <div key={t.label} className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-ink">{t.label}</div>
                <div className="text-[11px] text-ink-faint">{t.hint}</div>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" defaultValue={t.value} className="w-20 text-right tnum" />
                <span className="w-8 text-xs text-ink-faint">{t.unit}</span>
              </div>
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <span className="text-xs text-ink-faint">Defaults tuned for Dhaka practice (NBR + RAJUK norms)</span>
          <Button variant="primary" size="sm" disabled={!balanced}>Save thresholds</Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// ------------------------------------------------ Localization & data residency
function LocaleTab() {
  const [mirror, setMirror] = useState(false);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div>
            <CardKicker>Language & rendering</CardKicker>
            <CardTitle>Localization</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <FieldLabel>Interface language</FieldLabel>
            <Select
              value="en"
              options={[
                { value: "en", label: "English" },
                { value: "bn", label: "বাংলা — Bangla" },
              ]}
            />
          </div>
          <Card className="border-blue/20 bg-blue-tint/40 p-3.5 shadow-none">
            <div className="label-draft mb-1 text-blue">Bangla typesetting</div>
            <p className="text-[13px] text-ink-soft">
              Legacy <span className="font-medium text-ink">Bijoy</span> text is normalized to
              Unicode on ingest, and Bangla PDFs are typeset with the{" "}
              <span className="bn font-medium text-ink">Nikosh</span> font so client-facing reports
              render conjuncts correctly.
            </p>
          </Card>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardKicker>Compliance</CardKicker>
            <CardTitle>Data residency</CardTitle>
          </div>
          <Badge tone="neutral" size="sm">PDPO 2025</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <FieldLabel>Hosting region</FieldLabel>
            <Select
              value="singapore"
              options={[
                { value: "singapore", label: "Singapore (ap-southeast-1)" },
                { value: "mumbai", label: "Mumbai (ap-south-1)" },
              ]}
            />
            <p className="mt-1.5 text-[11px] text-ink-faint">
              Under Bangladesh's PDPO 2025, sensitive personal data carries localization
              expectations — choose the region closest to your clients.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border border-line bg-paper-2 px-3.5 py-3">
            <div>
              <div className="text-sm font-medium text-ink">Bangladesh local mirror</div>
              <p className="mt-0.5 text-[11px] text-ink-faint">
                Replicate sensitive records to an in-country mirror for residency. Off by default.
              </p>
            </div>
            <Switch checked={mirror} onCheckedChange={setMirror} />
          </div>

          <Card className="flex items-start gap-3 border-sage/30 bg-sage-tint/40 p-3.5 shadow-none">
            <ShieldCheck className="h-5 w-5 shrink-0 text-sage" />
            <p className="text-[13px] text-ink-soft">
              <span className="font-medium text-ink">Data minimization.</span> Space Esse never
              stores NID, TIN or passport numbers. We read only project, schedule and fee metadata
              from your existing tools — and only what a report needs.
            </p>
          </Card>
        </CardContent>
        <CardFooter>
          <span className="text-xs text-ink-faint">
            Coverage benchmark · {pct(80)} of records carry full provenance
          </span>
          <Button variant="outline" size="sm">View data map</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
