import {
  Archive,
  Banknote,
  Building2,
  ClipboardCheck,
  FolderOpen,
  History,
  LayoutDashboard,
  Layers,
  Radar,
  Settings,
  Users,
  Workflow,
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
    items: [
      { label: "Dashboard", to: "/", icon: LayoutDashboard },
      { label: "AI Radar", to: "/intelligence", icon: Radar, badge: "alert" },
      { label: "Automation", to: "/automation", icon: Workflow, badge: "alert" },
      { label: "Projects", to: "/projects", icon: Layers },
      { label: "Approvals", to: "/approvals", icon: ClipboardCheck, badge: "alert" },
      { label: "Files", to: "/files", icon: FolderOpen },
      { label: "Finance", to: "/finance", icon: Banknote },
      { label: "Clients", to: "/clients", icon: Building2 },
      { label: "Archive", to: "/archive", icon: Archive },
    ],
  },
  {
    heading: "Studio",
    items: [
      { label: "Team", to: "/team", icon: Users },
      { label: "Activity", to: "/activity", icon: History },
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];
