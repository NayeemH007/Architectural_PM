import {
  Activity,
  AlertTriangle,
  Banknote,
  Building2,
  Cable,
  CalendarDays,
  ClipboardCheck,
  Compass,
  Crosshair,
  FileStack,
  History,
  Landmark,
  LayoutDashboard,
  Layers,
  PencilLine,
  Send,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: "alert" | number;
}

export interface NavGroup {
  heading?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }],
  },
  {
    heading: "Projects",
    items: [
      { label: "Delivery & Ops", to: "/delivery", icon: Compass },
      { label: "Portfolio", to: "/portfolio", icon: Layers },
      { label: "Authority Approvals", to: "/approvals", icon: Landmark, badge: "alert" },
      { label: "Document Control", to: "/deliverables", icon: FileStack },
      { label: "Risks & Issues", to: "/risks", icon: AlertTriangle },
      { label: "Calendar", to: "/calendar", icon: CalendarDays },
    ],
  },
  {
    heading: "Finance",
    items: [
      { label: "Financials", to: "/financials", icon: Banknote },
      { label: "Profitability", to: "/profitability", icon: TrendingUp },
    ],
  },
  {
    heading: "Clients & Growth",
    items: [
      { label: "Clients", to: "/clients", icon: Building2 },
      { label: "Pipeline", to: "/pipeline", icon: Target },
      { label: "Goals & Targets", to: "/goals", icon: Crosshair },
    ],
  },
  {
    heading: "People",
    items: [{ label: "Resourcing", to: "/resourcing", icon: Users }],
  },
  {
    heading: "Intelligence",
    items: [
      { label: "AI Reports", to: "/reports", icon: Sparkles },
      { label: "Review Queue", to: "/review", icon: ClipboardCheck, badge: "alert" },
      { label: "Scheduled Reports", to: "/schedules", icon: Send },
    ],
  },
  {
    heading: "Data & Setup",
    items: [
      { label: "Manual Capture", to: "/capture", icon: PencilLine },
      { label: "Activity Log", to: "/activity", icon: History },
      { label: "Data Sources", to: "/data-sources", icon: Cable },
      { label: "Data Quality", to: "/data-quality", icon: Activity },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];
