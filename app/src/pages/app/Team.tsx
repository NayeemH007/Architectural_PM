import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  UserPlus,
  ShieldCheck,
  Crown,
  Mail,
  Briefcase,
  Compass,
  CheckCircle2,
  ArrowRight,
  Info,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/states";
import { useAiMembers, memberWorkload } from "@/lib/archintel/api";
import { activeProjects } from "@/lib/archintel/data";
import type { Member, MemberRole, ProjectA } from "@/lib/archintel/data";
import { cn } from "@/lib/cn";

// --- role presentation -------------------------------------------------------

const ROLE_LABEL: Record<MemberRole, string> = {
  founder: "Founder",
  principal: "Principal",
  project_lead: "Project Lead",
  designer: "Designer",
  finance: "Finance",
};

const ROLE_TONE: Record<MemberRole, "sienna" | "blue" | "sage" | "ochre" | "ink"> = {
  founder: "sienna",
  principal: "blue",
  project_lead: "sage",
  designer: "ochre",
  finance: "ink",
};

// Ordered from leadership down — drives both the role filter and the grouping.
const ROLE_ORDER: MemberRole[] = ["founder", "principal", "project_lead", "designer", "finance"];

const ROLE_BLURB: Record<MemberRole, string> = {
  founder: "Sets design direction · final sign-off authority",
  principal: "Coordinates design development & technical review",
  project_lead: "Owns project delivery through the 4-phase workflow",
  designer: "3D, visualization & technical drawing production",
  finance: "Billing, milestones & collections",
};

// A team of six is comfortable at ~4 active engagements each; beyond that we
// surface the load visually so the studio can rebalance before it bites.
const CAPACITY = 4;

interface Row {
  member: Member;
  led: number;
  assigned: number;
  load: number; // led counts double — it carries delivery accountability
}

export default function Team() {
  const { data: members = [], isLoading } = useAiMembers();

  const [role, setRole] = useState<MemberRole | "all">("all");
  const [openRoles, setOpenRoles] = useState<Record<string, boolean>>({});
  const [capacityOnly, setCapacityOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Join each member with their live workload. memberWorkload() reads the
  // module-level active project list, so it is stable across renders.
  const rows = useMemo<Row[]>(() => {
    const wl = memberWorkload();
    return members.map((member) => {
      const w = wl.find((x) => x.member.id === member.id);
      const led = w?.led ?? 0;
      const assigned = w?.assigned ?? 0;
      return { member, led, assigned, load: led * 2 + assigned };
    });
  }, [members]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (role !== "all" && r.member.role !== role) return false;
      if (capacityOnly && r.assigned >= CAPACITY) return false;
      return true;
    });
  }, [rows, role, capacityOnly]);

  // Group the filtered rows by role, preserving the leadership-first order.
  const groups = useMemo(() => {
    return ROLE_ORDER.map((r) => ({
      role: r,
      members: filtered.filter((row) => row.member.role === r),
    })).filter((g) => g.members.length > 0);
  }, [filtered]);

  const roleOptions = useMemo(() => {
    const counts = new Map<MemberRole, number>();
    rows.forEach((r) => counts.set(r.member.role, (counts.get(r.member.role) ?? 0) + 1));
    return [
      { value: "all", label: `All roles · ${rows.length}` },
      ...ROLE_ORDER.filter((r) => (counts.get(r) ?? 0) > 0).map((r) => ({
        value: r,
        label: `${ROLE_LABEL[r]} · ${counts.get(r)}`,
      })),
    ];
  }, [rows]);

  const isRoleOpen = (r: string) => openRoles[r] !== true; // default expanded
  const toggleRole = (r: string) => setOpenRoles((p) => ({ ...p, [r]: !p[r] }));

  const selected = rows.find((r) => r.member.id === selectedId) ?? null;
  const ledProjects: ProjectA[] = selected
    ? activeProjects.filter((p) => p.leadId === selected.member.id)
    : [];
  const assignedProjects: ProjectA[] = selected
    ? activeProjects.filter(
        (p) => p.teamIds.includes(selected.member.id) && p.leadId !== selected.member.id,
      )
    : [];

  const approverRow = rows.find((r) => r.member.isApprover) ?? null;
  const leadsCount = rows.filter((r) => r.member.role === "project_lead").length;
  const fullyLoaded = rows.filter((r) => r.assigned >= CAPACITY).length;

  return (
    <Page>
      <PageHeader
        kicker="Studio"
        title="Team"
        description="Roles, approval authority, and live workload across the studio's active engagements."
        actions={<InviteDialog />}
      />

      {/* Approval authority highlight ----------------------------------- */}
      {!isLoading && approverRow && (
        <Card drafting className="mt-6 border-sienna/30 bg-sienna-tint/40">
          <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sienna text-paper">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="label-draft text-sienna">Approval authority</div>
                <p className="mt-0.5 text-sm text-ink">
                  <span className="font-medium">{approverRow.member.name}</span> is the final
                  approver for all design &amp; material decisions. Nothing reaches the client until
                  it clears her review.
                </p>
                <p className="mt-1.5 text-xs text-ink-soft">
                  Lead prepares
                  <ArrowRight className="mx-1 inline h-3 w-3 text-ink-ghost" />
                  Fariha coordinates
                  <ArrowRight className="mx-1 inline h-3 w-3 text-ink-ghost" />
                  <span className="font-medium text-sienna">Raiana approves</span>
                  <ArrowRight className="mx-1 inline h-3 w-3 text-ink-ghost" />
                  client receives
                  <ArrowRight className="mx-1 inline h-3 w-3 text-ink-ghost" />
                  docs released
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-start border-sienna/40 text-sienna hover:bg-sienna-tint"
              onClick={() => setSelectedId(approverRow.member.id)}
            >
              View workload
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI row -------------------------------------------------------- */}
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
              kicker="Team members"
              value={String(rows.length)}
              footnote={<span className="text-xs text-ink-ghost">{groups.length} roles</span>}
            />
            <KpiCard
              kicker="Project leads"
              value={String(leadsCount)}
              footnote={<span className="text-xs text-ink-ghost">own delivery end-to-end</span>}
            />
            <KpiCard
              kicker="Active engagements"
              value={String(activeProjects.length)}
              footnote={<span className="text-xs text-ink-ghost">across the studio</span>}
            />
            <KpiCard
              kicker="At capacity"
              value={String(fullyLoaded)}
              footnote={
                <span className="text-xs text-ink-ghost">
                  {CAPACITY}+ active · consider rebalancing
                </span>
              }
            />
          </>
        )}
      </div>

      {/* Toolbar ------------------------------------------------------- */}
      {!isLoading && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Select
            size="sm"
            value={role}
            onValueChange={(v) => setRole(v as MemberRole | "all")}
            options={roleOptions}
            className="sm:max-w-[14rem]"
          />
          <label className="flex cursor-pointer items-center gap-2.5 text-xs text-ink-soft">
            <Switch checked={capacityOnly} onCheckedChange={setCapacityOnly} />
            Show available capacity only
          </label>
        </div>
      )}

      {/* Body ---------------------------------------------------------- */}
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
              icon={Compass}
              title="No members match"
              description="Adjust the role filter or turn off the capacity toggle to see the full team."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRole("all");
                    setCapacityOnly(false);
                  }}
                >
                  Reset filters
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.role}>
                <button
                  className="group mb-3 flex w-full items-center gap-3 text-left"
                  onClick={() => toggleRole(g.role)}
                  aria-expanded={isRoleOpen(g.role)}
                >
                  <Badge tone={ROLE_TONE[g.role]} size="md" dot>
                    {ROLE_LABEL[g.role]}
                  </Badge>
                  <span className="text-xs text-ink-faint">{ROLE_BLURB[g.role]}</span>
                  <span className="ml-auto tnum text-xs text-ink-ghost">
                    {g.members.length} {g.members.length === 1 ? "member" : "members"}
                  </span>
                </button>
                {isRoleOpen(g.role) && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {g.members.map((row) => (
                      <MemberCard
                        key={row.member.id}
                        row={row}
                        active={selectedId === row.member.id}
                        onSelect={() =>
                          setSelectedId((id) => (id === row.member.id ? null : row.member.id))
                        }
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Selected member detail --------------------------------------- */}
      {selected && (
        <Card drafting className="mt-8">
          <CardContent className="py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={selected.member.name} tone={selected.member.tone} size="md" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-[17px] text-ink">{selected.member.name}</h3>
                    {selected.member.isApprover && (
                      <Badge tone="sienna" size="sm">
                        <Crown className="h-3 w-3" />
                        Final approver
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-ink-faint">{selected.member.title}</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                Close
              </Button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <DetailColumn
                icon={Briefcase}
                title="Leading"
                count={ledProjects.length}
                projects={ledProjects}
                emptyLabel="Not leading any active project"
              />
              <DetailColumn
                icon={Compass}
                title="Assigned to"
                count={assignedProjects.length}
                projects={assignedProjects}
                emptyLabel="No additional assignments"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </Page>
  );
}

// --- member card -------------------------------------------------------------

function MemberCard({
  row,
  active,
  onSelect,
}: {
  row: Row;
  active: boolean;
  onSelect: () => void;
}) {
  const { member, led, assigned } = row;
  const loadPct = Math.min(100, Math.round((assigned / CAPACITY) * 100));
  const loadTone = assigned >= CAPACITY ? "rust" : assigned >= 3 ? "ochre" : "sage";

  return (
    <Card
      onClick={onSelect}
      drafting={active}
      className={cn(
        "flex h-full cursor-pointer flex-col transition-shadow hover:shadow-lift",
        active && "ring-2 ring-blue/30",
      )}
    >
      <CardContent className="flex flex-1 flex-col py-4">
        {/* header */}
        <div className="flex items-start gap-3">
          <Avatar name={member.name} tone={member.tone} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-display text-[16px] leading-tight text-ink">
                {member.name}
              </h3>
              {member.isApprover && (
                <Tooltip content="Final design & material approver">
                  <Crown className="h-3.5 w-3.5 shrink-0 text-sienna" />
                </Tooltip>
              )}
            </div>
            <div className="mt-0.5 truncate text-xs text-ink-faint">{member.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge tone={ROLE_TONE[member.role]} size="sm">
                {ROLE_LABEL[member.role]}
              </Badge>
              {member.isApprover && (
                <Badge tone="sienna" size="sm">
                  <ShieldCheck className="h-3 w-3" />
                  Final approver
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* email */}
        <Tooltip content={member.email}>
          <a
            href={`mailto:${member.email}`}
            onClick={(e) => e.stopPropagation()}
            className="mt-3 flex items-center gap-2 text-xs text-ink-soft hover:text-blue"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-ink-ghost" />
            <span className="truncate">{member.email}</span>
          </a>
        </Tooltip>

        {/* workload */}
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-ink-soft">
              <Briefcase className="h-3.5 w-3.5 text-ink-ghost" />
              Workload
            </span>
            <span className="tnum text-ink-faint">
              <span className="font-medium text-ink">{led}</span> led ·{" "}
              <span className="font-medium text-ink">{assigned}</span> assigned
            </span>
          </div>
          <div className="mt-2">
            <Progress value={loadPct} tone={loadTone} />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="label-draft text-ink-ghost">
              {assigned} / {CAPACITY} active
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                loadTone === "rust"
                  ? "text-rust"
                  : loadTone === "ochre"
                    ? "text-ochre"
                    : "text-sage",
              )}
            >
              {assigned >= CAPACITY
                ? "At capacity"
                : assigned === 0
                  ? "Available"
                  : "Has capacity"}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- selected-member detail column ------------------------------------------

function DetailColumn({
  icon: Icon,
  title,
  count,
  projects,
  emptyLabel,
}: {
  icon: typeof Briefcase;
  title: string;
  count: number;
  projects: ProjectA[];
  emptyLabel: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-ink-ghost" />
        <span className="font-display text-sm text-ink">{title}</span>
        <Badge tone="neutral" size="sm" className="tnum">
          {count}
        </Badge>
      </div>
      {projects.length === 0 ? (
        <p className="rounded-md border border-dashed border-line bg-paper-2 px-3 py-2.5 text-xs text-ink-ghost">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/projects/${p.id}`}
                className="flex items-center justify-between gap-2 rounded-md border border-line bg-paper-2 px-3 py-2 text-sm transition-colors hover:border-blue/40 hover:bg-blue-tint/40"
              >
                <span className="min-w-0">
                  <span className="label-draft text-ink-ghost">{p.code}</span>
                  <span className="block truncate text-ink">{p.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      p.health === "at_risk"
                        ? "bg-rust"
                        : p.health === "watch"
                          ? "bg-ochre"
                          : "bg-sage",
                    )}
                  />
                  <ArrowRight className="h-3.5 w-3.5 text-ink-ghost" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- invite dialog (visual only) --------------------------------------------

function InviteDialog() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("designer");

  const reset = () => {
    setSent(false);
    setEmail("");
    setRole("designer");
  };

  return (
    <Dialog onOpenChange={(o) => !o && reset()}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <UserPlus className="h-4 w-4" />
          Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            Send a studio invite. Design &amp; material approvals stay with Raiana regardless of
            role.
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="px-5 py-8 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sage-tint text-sage">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <p className="font-display text-ink">Invite ready to send</p>
            <p className="mt-1 text-sm text-ink-soft">
              {email || "the new member"} would receive a {ROLE_LABEL[role]} invite.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-ghost">
              <Info className="h-3.5 w-3.5" />
              Prototype — no email is actually sent.
            </p>
            <DialogClose asChild>
              <Button variant="outline" size="sm" className="mt-5">
                Done
              </Button>
            </DialogClose>
          </div>
        ) : (
          <div className="px-5 py-5">
            <label className="label-draft mb-1.5 block text-ink-soft">Work email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@spaceesse.com"
              className="h-9 w-full rounded-md border border-line-strong bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink-ghost focus:border-blue focus:ring-2 focus:ring-blue/20"
            />
            <label className="label-draft mb-1.5 mt-4 block text-ink-soft">Role</label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as MemberRole)}
              options={ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
            <div className="mt-6 flex items-center justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
              </DialogClose>
              <Button variant="primary" size="sm" onClick={() => setSent(true)}>
                <UserPlus className="h-4 w-4" />
                Send invite
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
