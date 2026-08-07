import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { ArkonLogo } from '@/components/ArkonLogo';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardLayout } from '@/components/DashboardLayout';
import { HomePage } from '@/pages/HomePage';
import { WorkerApp, WorkerHome, WorkerVisits, WorkerQr, WorkerProfile, WorkerNotifications } from '@/pages/WorkerApp';
import { ClientApp, ClientHome, ClientVisits, ClientInvoices, ClientSupport, ClientProfile } from '@/pages/ClientApp';
import { getDefaultRoute } from '@/lib/navigation';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy-loaded staff pages — only loaded when the user navigates to them
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PackagesPage = lazy(() => import('@/pages/PackagesPage').then(m => ({ default: m.PackagesPage })));
const ContractsPage = lazy(() => import('@/pages/ContractsPage').then(m => ({ default: m.ContractsPage })));
const NewContractPage = lazy(() => import('@/pages/NewContractPage').then(m => ({ default: m.NewContractPage })));
const ContractDetailPage = lazy(() => import('@/pages/ContractDetailPage').then(m => ({ default: m.ContractDetailPage })));
const ClientsPage = lazy(() => import('@/pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ClientProfilePage = lazy(() => import('@/pages/ClientProfilePage').then(m => ({ default: m.ClientProfilePage })));
const EmployeesPage = lazy(() => import('@/pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const SchedulePage = lazy(() => import('@/pages/SchedulePage').then(m => ({ default: m.SchedulePage })));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AuditPage = lazy(() => import('@/pages/AuditPage').then(m => ({ default: m.AuditPage })));
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const InventoryPage = lazy(() => import('@/pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage').then(m => ({ default: m.InvoicesPage })));
const SalesPage = lazy(() => import('@/pages/SalesPage').then(m => ({ default: m.SalesPage })));
const OpportunitiesPage = lazy(() => import('@/pages/OpportunitiesPage').then(m => ({ default: m.OpportunitiesPage })));
const FinancePage = lazy(() => import('@/pages/FinancePage').then(m => ({ default: m.FinancePage })));
const VisitsPage = lazy(() => import('@/pages/VisitsPage').then(m => ({ default: m.VisitsPage })));
const AdditionalVisitsPage = lazy(() => import('@/pages/AdditionalVisitsPage').then(m => ({ default: m.AdditionalVisitsPage })));
const SupportPage = lazy(() => import('@/pages/SupportPage').then(m => ({ default: m.SupportPage })));
const ArkonOSPage = lazy(() => import('@/pages/ArkonOSPage').then(m => ({ default: m.ArkonOSPage })));

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }
    if (permission && session.kind === 'staff') {
      const perms = session.permissions ?? [];
      if (!perms.includes(permission) && !perms.includes('all_access')) {
        navigate(getDefaultRoute(perms, session.kind, session.role?.key), { replace: true });
      }
    }
  }, [session, loading, navigate, permission, location.pathname]);

  if (loading || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !session) return;
    if (location.pathname === '/' || location.pathname === '/login') {
      navigate(getDefaultRoute(session.permissions ?? [], session.kind, session.role?.key), { replace: true });
    }
  }, [session, loading, navigate, location.pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Staff + Worker layout */}
      <Route element={<ProtectedRoute><ErrorBoundary resetKey="staff-layout"><DashboardLayout /></ErrorBoundary></ProtectedRoute>}>
        <Route path="/dashboard" element={<ProtectedRoute permission="dashboard"><LazyPage><DashboardPage /></LazyPage></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute permission="clients"><LazyPage><ClientsPage /></LazyPage></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute permission="clients"><LazyPage><ClientProfilePage /></LazyPage></ProtectedRoute>} />
        <Route path="/employees" element={<ProtectedRoute permission="employees"><LazyPage><EmployeesPage /></LazyPage></ProtectedRoute>} />
        <Route path="/contracts" element={<ProtectedRoute permission="contracts"><LazyPage><ContractsPage /></LazyPage></ProtectedRoute>} />
        <Route path="/contracts/new" element={<ProtectedRoute permission="contracts"><LazyPage><NewContractPage /></LazyPage></ProtectedRoute>} />
        <Route path="/contracts/:id" element={<ProtectedRoute permission="contracts"><LazyPage><ContractDetailPage /></LazyPage></ProtectedRoute>} />
        <Route path="/packages" element={<ProtectedRoute permission="packages"><LazyPage><PackagesPage /></LazyPage></ProtectedRoute>} />
        <Route path="/visits" element={<ProtectedRoute permission="visits"><LazyPage><VisitsPage /></LazyPage></ProtectedRoute>} />
        <Route path="/additional-visits" element={<ProtectedRoute permission="visits"><LazyPage><AdditionalVisitsPage /></LazyPage></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute permission="invoices"><LazyPage><InvoicesPage /></LazyPage></ProtectedRoute>} />
        <Route path="/schedule" element={<ProtectedRoute permission="schedule"><LazyPage><SchedulePage /></LazyPage></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute permission="calendar"><LazyPage><CalendarPage /></LazyPage></ProtectedRoute>} />
        <Route path="/sales" element={<ProtectedRoute permission="sales"><LazyPage><SalesPage /></LazyPage></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute permission="inventory"><LazyPage><InventoryPage /></LazyPage></ProtectedRoute>} />
        <Route path="/opportunities" element={<ProtectedRoute permission="opportunities"><LazyPage><OpportunitiesPage /></LazyPage></ProtectedRoute>} />
        <Route path="/finance" element={<ProtectedRoute permission="finance"><LazyPage><FinancePage /></LazyPage></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute permission="reports"><LazyPage><ReportsPage /></LazyPage></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute permission="audit"><LazyPage><AuditPage /></LazyPage></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute permission="notifications"><LazyPage><SupportPage /></LazyPage></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute permission="notifications"><LazyPage><NotificationsPage /></LazyPage></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute permission="settings"><LazyPage><SettingsPage /></LazyPage></ProtectedRoute>} />

        {/* Worker routes */}
        <Route path="/worker" element={<ProtectedRoute permission="worker_home"><WorkerHome /></ProtectedRoute>} />
        <Route path="/worker/visits" element={<ProtectedRoute permission="worker_visits"><WorkerVisits /></ProtectedRoute>} />
        <Route path="/worker/qr" element={<ProtectedRoute permission="worker_qr"><WorkerQr /></ProtectedRoute>} />
        <Route path="/worker/profile" element={<ProtectedRoute permission="worker_profile"><WorkerProfile /></ProtectedRoute>} />
        <Route path="/worker/notifications" element={<ProtectedRoute permission="worker_home"><WorkerNotifications /></ProtectedRoute>} />
      </Route>

      {/* Client portal */}
      <Route element={<ProtectedRoute permission="client_home"><ErrorBoundary resetKey="client-layout"><ClientApp /></ErrorBoundary></ProtectedRoute>}>
        <Route path="/client" element={<ProtectedRoute permission="client_home"><ClientHome /></ProtectedRoute>} />
        <Route path="/client/visits" element={<ProtectedRoute permission="client_visits"><ClientVisits /></ProtectedRoute>} />
        <Route path="/client/invoices" element={<ProtectedRoute permission="client_invoices"><ClientInvoices /></ProtectedRoute>} />
        <Route path="/client/support" element={<ProtectedRoute permission="client_support"><ClientSupport /></ProtectedRoute>} />
        <Route path="/client/profile" element={<ProtectedRoute permission="client_profile"><ClientProfile /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
