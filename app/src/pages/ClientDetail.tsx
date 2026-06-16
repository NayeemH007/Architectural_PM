import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Page } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ProjectCard } from "@/components/project-card";
import { bdt, num, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { clientById, invoices, projects } from "@/lib/mock/data";
import { contactsByClient } from "@/lib/mock/ops";
import type { Client } from "@/lib/types";

const CLIENT_TYPE: Record<Client["type"], { label: string; tone: "blue" | "sage" | "ochre" | "sienna" | "neutral" }> = {
  developer: { label: "Developer", tone: "blue" },
  private: { label: "Private", tone: "sage" },
  corporate: { label: "Corporate", tone: "ochre" },
  government: { label: "Government", tone: "sienna" },
  institution: { label: "Institution", tone: "neutral" },
};

const RELATIONSHIP: Record<Client["relationship"], { label: string; tone: "sage" | "neutral" | "rust" }> = {
  strong: { label: "Strong", tone: "sage" },
  neutral: { label: "Neutral", tone: "neutral" },
  at_risk: { label: "At risk", tone: "rust" },
};

const AVATAR_TONES = ["blue", "sienna", "sage", "ochre"];

export default function ClientDetail() {
  const { id } = useParams();
  const client = id ? clientById(id) : undefined;

  const clientProjects = useMemo(
    () => (client ? projects.filter((p) => p.clientId === client.id) : []),
    [client],
  );

  const clientInvoices = useMemo(
    () => (client ? invoices.filter((i) => i.client === client.name) : []),
    [client],
  );

  const contacts = client ? contactsByClient(client.id) : [];

  if (!client) {
    return (
      <Page>
        <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Clients
        </Link>
        <Card className="mt-6 p-10 text-center">
          <h1 className="font-display text-xl text-ink">Client not found</h1>
          <p className="mt-2 text-sm text-ink-soft">
            We couldn't find an account for <span className="font-mono text-ink">{id ?? "—"}</span>.
          </p>
          <Link to="/clients" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue hover:underline">
            <ArrowLeft className="h-4 w-4" /> Back to all clients
          </Link>
        </Card>
      </Page>
    );
  }

  const rel = RELATIONSHIP[client.relationship];
  const type = CLIENT_TYPE[client.type];

  return (
    <Page>
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>

      {/* header */}
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="label-draft">{type.label} · {client.city}</div>
          <h1 className="mt-1 font-display text-[28px] leading-tight text-ink">{client.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={type.tone}>{type.label}</Badge>
            <Badge tone={rel.tone} dot>{rel.label}</Badge>
            <span className="text-sm text-ink-soft">
              · {num(client.activeProjects)} active {client.activeProjects === 1 ? "project" : "projects"}
            </span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard kicker="Lifetime fee" value={bdt(client.lifetimeFee, { compact: true })} />
        <KpiCard
          kicker="Outstanding"
          value={client.outstanding > 0 ? bdt(client.outstanding, { compact: true }) : "৳0"}
          footnote={
            client.outstanding > 0 && client.relationship === "at_risk" ? (
              <span className="text-xs text-rust">at-risk receivable</span>
            ) : (
              <span className="text-xs text-ink-faint">{client.outstanding > 0 ? "open balance" : "all settled"}</span>
            )
          }
        />
        <KpiCard kicker="Active projects" value={num(client.activeProjects)} />
        <KpiCard kicker="Relationship" value={rel.label} />
      </div>

      {/* contacts */}
      <Card className="mt-8">
        <CardHeader>
          <div>
            <CardKicker>Key people</CardKicker>
            <CardTitle>Contacts</CardTitle>
          </div>
          <Badge tone="neutral" size="sm">{num(contacts.length)}</Badge>
        </CardHeader>
        <div className="divide-y divide-line border-t border-line">
          {contacts.map((ct, i) => (
            <div key={ct.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={ct.name} tone={AVATAR_TONES[i % AVATAR_TONES.length]} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{ct.name}</span>
                    {ct.primary && <Badge tone="blue" size="sm">Primary</Badge>}
                  </div>
                  <div className="text-xs text-ink-faint">{ct.role}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 pl-12 text-xs text-ink-soft sm:pl-0">
                <a href={`mailto:${ct.email}`} className="inline-flex items-center gap-1.5 hover:text-blue">
                  <Mail className="h-3.5 w-3.5 text-ink-ghost" /> {ct.email}
                </a>
                <a href={`tel:${ct.phone}`} className="inline-flex items-center gap-1.5 font-mono tnum hover:text-blue">
                  <Phone className="h-3.5 w-3.5 text-ink-ghost" /> {ct.phone}
                </a>
              </div>
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="px-5 py-6 text-sm text-ink-faint">No contacts recorded for this client yet.</div>
          )}
        </div>
      </Card>

      {/* projects */}
      <div className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-ink">Projects</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Work delivered and in progress for this account.</p>
          </div>
          <Badge tone="neutral" size="sm">{num(clientProjects.length)}</Badge>
        </div>
        {clientProjects.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-faint">No projects linked to this client.</Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clientProjects.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>

      {/* invoices */}
      <Card className="mt-8">
        <CardHeader>
          <div>
            <CardKicker>Ledger</CardKicker>
            <CardTitle>Invoices</CardTitle>
          </div>
          <Badge tone="neutral" size="sm">{num(clientInvoices.length)}</Badge>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Invoice</TH>
              <TH>Issued</TH>
              <TH className="text-right">Net receivable</TH>
              <TH className="text-right">Received</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {clientInvoices.map((i) => (
              <TR key={i.id}>
                <TD className="font-mono text-xs">{i.number}</TD>
                <TD className="text-ink-soft">{shortDate(i.issueDate)}</TD>
                <TD className="text-right tnum font-medium">{bdt(i.netReceivable, { compact: true })}</TD>
                <TD className="text-right tnum text-ink-soft">{bdt(i.amountReceived, { compact: true })}</TD>
                <TD>
                  <Badge
                    tone={
                      i.status === "overdue"
                        ? "rust"
                        : i.status === "paid"
                          ? "sage"
                          : i.status === "part_paid"
                            ? "ochre"
                            : "neutral"
                    }
                    size="sm"
                  >
                    {i.status === "overdue" ? `${i.agingDays}d overdue` : i.status.replace("_", " ")}
                  </Badge>
                </TD>
              </TR>
            ))}
            {clientInvoices.length === 0 && (
              <TR>
                <TD colSpan={5}>
                  <span className="text-sm text-ink-faint">No invoices for this client yet.</span>
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </Card>
    </Page>
  );
}
