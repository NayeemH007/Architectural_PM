import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";

// Pre-app (full-screen, no shell)
const Signup = lazy(() => import("@/pages/app/Signup"));
const Onboarding = lazy(() => import("@/pages/app/Onboarding"));

// In-app (inside AppShell)
const Dashboard = lazy(() => import("@/pages/app/Dashboard"));
const Projects = lazy(() => import("@/pages/app/Projects"));
const ProjectSetup = lazy(() => import("@/pages/app/ProjectSetup"));
const ProjectWorkspace = lazy(() => import("@/pages/app/ProjectWorkspace"));
const Approvals = lazy(() => import("@/pages/app/Approvals"));
const Intelligence = lazy(() => import("@/pages/app/Intelligence"));
const Files = lazy(() => import("@/pages/app/Files"));
const Finance = lazy(() => import("@/pages/app/Finance"));
const Clients = lazy(() => import("@/pages/app/Clients"));
const ClientDetail = lazy(() => import("@/pages/app/ClientDetail"));
const ArchivePage = lazy(() => import("@/pages/app/Archive"));
const Team = lazy(() => import("@/pages/app/Team"));
const ActivityPage = lazy(() => import("@/pages/app/Activity"));
const Settings = lazy(() => import("@/pages/app/Settings"));

function Loader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex items-center gap-2 text-ink-faint">
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue [animation-delay:300ms]" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/new" element={<ProjectSetup />} />
          <Route path="/projects/:id" element={<ProjectWorkspace />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/files" element={<Files />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/team" element={<Team />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
