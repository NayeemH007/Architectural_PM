import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Delivery = lazy(() => import("@/pages/Delivery"));
const Portfolio = lazy(() => import("@/pages/Portfolio"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const Financials = lazy(() => import("@/pages/Financials"));
const Profitability = lazy(() => import("@/pages/Profitability"));
const Resourcing = lazy(() => import("@/pages/Resourcing"));
const Pipeline = lazy(() => import("@/pages/Pipeline"));
const Approvals = lazy(() => import("@/pages/Approvals"));
const Deliverables = lazy(() => import("@/pages/Deliverables"));
const Risks = lazy(() => import("@/pages/Risks"));
const AIReports = lazy(() => import("@/pages/AIReports"));
const DataSources = lazy(() => import("@/pages/DataSources"));
const DataQuality = lazy(() => import("@/pages/DataQuality"));
const Capture = lazy(() => import("@/pages/Capture"));
const Settings = lazy(() => import("@/pages/Settings"));
const Clients = lazy(() => import("@/pages/Clients"));
const ClientDetail = lazy(() => import("@/pages/ClientDetail"));
const Goals = lazy(() => import("@/pages/Goals"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Schedules = lazy(() => import("@/pages/Schedules"));
const Review = lazy(() => import("@/pages/Review"));
const ActivityLog = lazy(() => import("@/pages/ActivityLog"));
const Search = lazy(() => import("@/pages/Search"));

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
        <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/financials" element={<Financials />} />
          <Route path="/profitability" element={<Profitability />} />
          <Route path="/resourcing" element={<Resourcing />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/deliverables" element={<Deliverables />} />
          <Route path="/risks" element={<Risks />} />
          <Route path="/reports" element={<AIReports />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/schedules" element={<Schedules />} />
          <Route path="/review" element={<Review />} />
          <Route path="/activity" element={<ActivityLog />} />
          <Route path="/search" element={<Search />} />
          <Route path="/data-sources" element={<DataSources />} />
          <Route path="/data-quality" element={<DataQuality />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
