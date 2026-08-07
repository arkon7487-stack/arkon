import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
const AdditionalVisitsPage = lazy(() => import('@/pages/AdditionalVisitsPage').then(m => ({ default: m.AdditionalVisitsPage })));
const VisitsPage = lazy(() => import('@/pages/VisitsPage').then(m => ({ default: m.VisitsPage })));
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const AuditPage = lazy(() => import('@/pages/AuditPage').then(m => ({ default: m.AuditPage })));
const NewClientPage = lazy(() => import('@/pages/NewClientPage').then(m => ({ default: m.NewClientPage })));
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage').then(m => ({ default: m.InvoicesPage })));
const InventoryPage = lazy(() => import('@/pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const OpportunitiesPage = lazy(() => import('@/pages/OpportunitiesPage').then(m => ({ default: m.OpportunitiesPage })));
const FinancePage = lazy(() => import('@/pages/FinancePage').then(m => ({ default: m.FinancePage })));
const SalesPage = lazy(() => import('@/pages/SalesPage').then(m => ({ default: m.SalesPage })));
const ArkonOSPage = lazy(() => import('@/pages/ArkonOSPage').then(m => ({ default: m.ArkonOSPage })));

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <ArkonLogo size={56} />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-brand-500" style={{ backgroundSize: '200% 100%' }} />
        </div>
      </div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-500" />
        <span className="text-xs text-slate-400">جاري التحميل...</span>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center" dir="rtl">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger-50">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger-500">
          <circle cx="12" cy="12" r="10" />
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
        </svg>
      </div>
      <h1 className="font-display text-xl font-700 text-slate-900">لا تملك صلاحية الوصول</h1>
      <p className="text-sm text-slate-500">هذه الصفحة غير متاحة لدورك الوظيفي.</p>
    </div>
  );
}

function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { session, loading, hasPermission } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session && permission && !hasPermission(permission)) {
      const defaultRoute = getDefaultRoute(session.permissions ?? [], session.kind, session.role?.key);
      navigate(defaultRoute, { replace: true });
    }
  }, [session, loading, permission, hasPermission, navigate]);

  if (loading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) return <AccessDenied />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) {
    const defaultRoute = getDefaultRoute(session.permissions ?? [], session.kind, session.role?.key);
    return <Navigate to={defaultRoute} replace />;
  }
  return <>{children}</>;
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/os" element={<LazyPage><ArkonOSPage /></LazyPage>} />
            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />

            {/* Staff routes */}
            <Route element={<ProtectedRoute><ErrorBoundary><DashboardLayout /></ErrorBoundary></ProtectedRoute>}>
              <Route path="/dashboard" element={<ProtectedRoute permission="dashboard"><LazyPage><DashboardPage /></LazyPage></ProtectedRoute>} />
              <Route path="/packages" element={<ProtectedRoute permission="packages"><LazyPage><PackagesPage /></LazyPage></ProtectedRoute>} />
              <Route path="/contracts" element={<ProtectedRoute permission="contracts"><LazyPage><ContractsPage /></LazyPage></ProtectedRoute>} />
              <Route path="/contracts/new" element={<ProtectedRoute permission="contracts"><LazyPage><NewContractPage /></LazyPage></ProtectedRoute>} />
              <Route path="/contracts/:id" element={<ProtectedRoute permission="contracts"><LazyPage><ContractDetailPage /></LazyPage></ProtectedRoute>} />
              <Route path="/clients" element={<ProtectedRoute permission="clients"><LazyPage><ClientsPage /></LazyPage></ProtectedRoute>} />
              <Route path="/clients/new" element={<ProtectedRoute permission="clients"><LazyPage><NewClientPage /></LazyPage></ProtectedRoute>} />
              <Route path="/clients/:id" element={<ProtectedRoute permission="clients"><LazyPage><ClientProfilePage /></LazyPage></ProtectedRoute>} />
              <Route path="/employees" element={<ProtectedRoute permission="employees"><LazyPage><EmployeesPage /></LazyPage></ProtectedRoute>} />
              <Route path="/visits" element={<ProtectedRoute permission="visits"><LazyPage><VisitsPage /></LazyPage></ProtectedRoute>} />
              <Route path="/additional-visits" element={<ProtectedRoute permission="visits"><LazyPage><AdditionalVisitsPage /></LazyPage></ProtectedRoute>} />
              <Route path="/schedule" element={<ProtectedRoute permission="schedule"><LazyPage><SchedulePage /></LazyPage></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute permission="calendar"><LazyPage><CalendarPage /></LazyPage></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute permission="reports"><LazyPage><ReportsPage /></LazyPage></ProtectedRoute>} />
              <Route path="/audit" element={<ProtectedRoute permission="audit"><LazyPage><AuditPage /></LazyPage></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute permission="notifications"><LazyPage><NotificationsPage /></LazyPage></ProtectedRoute>} />
              <Route path="/invoices" element={<ProtectedRoute permission="invoices"><LazyPage><InvoicesPage /></LazyPage></ProtectedRoute>} />
              <Route path="/inventory" element={<ProtectedRoute permission="inventory"><LazyPage><InventoryPage /></LazyPage></ProtectedRoute>} />
              <Route path="/opportunities" element={<ProtectedRoute permission="opportunities"><LazyPage><OpportunitiesPage /></LazyPage></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute permission="finance"><LazyPage><FinancePage /></LazyPage></ProtectedRoute>} />
              <Route path="/sales" element={<ProtectedRoute permission="sales"><LazyPage><SalesPage /></LazyPage></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute permission="settings"><LazyPage><SettingsPage /></LazyPage></ProtectedRoute>} />
            </Route>

            {/* Worker mobile app */}
            <Route element={<ProtectedRoute permission="worker_home"><ErrorBoundary><WorkerApp /></ErrorBoundary></ProtectedRoute>}>
              <Route path="/worker" element={<ProtectedRoute permission="worker_home"><WorkerHome /></ProtectedRoute>} />
              <Route path="/worker/visits" element={<ProtectedRoute permission="worker_visits"><WorkerVisits /></ProtectedRoute>} />
              <Route path="/worker/qr" element={<ProtectedRoute permission="worker_qr"><WorkerQr /></ProtectedRoute>} />
              <Route path="/worker/profile" element={<ProtectedRoute permission="worker_profile"><WorkerProfile /></ProtectedRoute>} />
              <Route path="/worker/notifications" element={<ProtectedRoute permission="worker_home"><WorkerNotifications /></ProtectedRoute>} />
            </Route>

            {/* Client mobile app */}
            <Route element={<ProtectedRoute permission="client_home"><ErrorBoundary><ClientApp /></ErrorBoundary></ProtectedRoute>}>
              <Route path="/client" element={<ProtectedRoute permission="client_home"><ClientHome /></ProtectedRoute>} />
              <Route path="/client/visits" element={<ProtectedRoute permission="client_visits"><ClientVisits /></ProtectedRoute>} />
              <Route path="/client/invoices" element={<ProtectedRoute permission="client_invoices"><ClientInvoices /></ProtectedRoute>} />
              <Route path="/client/support" element={<ProtectedRoute permission="client_support"><ClientSupport /></ProtectedRoute>} />
              <Route path="/client/profile" element={<ProtectedRoute permission="client_profile"><ClientProfile /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}