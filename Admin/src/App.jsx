import React, { useState, useEffect, Suspense, lazy } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import Sidebar from './components/sidebar';
import { Routes, Route } from 'react-router-dom';
import './index.css';
import 'react-toastify/dist/ReactToastify.css';
// The Finance ERP's four shared stylesheets — eager, not left to whichever
// lazy route chunk happens to import them first. Every route below is
// code-split (see the lazy() calls), and each one's CSS bundle only
// contains what its own static-import tree pulls in; dozens of finance
// components use classes from these four files without importing them
// directly, relying on some OTHER already-visited page having loaded it
// first. That's fine for in-SPA navigation (the stylesheet stays injected
// once loaded) but breaks completely on a hard refresh/direct link into a
// route whose own tree never imports the file a class it uses actually
// lives in — the exact bug reported on Site Operations, which turned out
// to affect most of the Finance ERP's non-work-detail routes once audited.
// Loading all four upfront trades a few hundred KB of always-eager CSS for
// eliminating that whole bug class outright, rather than chasing it file
// by file as new components get added.
import './styles/add.css';
import './styles/list.css';
import './styles/wizard.css';
import './styles/dashboard.css';
import { ToastContainer } from 'react-toastify';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { FINANCE_ROUTES } from './config/financeNav';
import { Navigate } from "react-router-dom";

// Every routed page is lazy — each one only ships the JS it actually
// needs when its route is visited, instead of the whole Finance ERP
// (~45 page components) loading upfront on every visit, including the
// login screen. Navbar/Sidebar/Login/ProtectedRoute stay eager since
// they're part of the persistent app shell, not a route.
const AddDesign    = lazy(() => import('./pages/AddDesign'));
const ListDesigns  = lazy(() => import('./pages/ListDesigns'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Quotes = lazy(() => import('./pages/Quotes'));
const AddProject = lazy(() => import('./pages/AddProject'));
const ListProjects = lazy(() => import('./pages/ListProjects'));
const MyAccount      = lazy(() => import('./pages/MyAccount'));
const AdminRequests  = lazy(() => import('./pages/AdminRequests'));
const RecoveryBin    = lazy(() => import('./pages/RecoveryBin'));
const AddProduct = lazy(() => import('./pages/AddProduct'));
const ListProducts = lazy(() => import('./pages/ListProducts'));
const AddTestimonial   = lazy(() => import('./pages/AddTestimonial'));
const ListTestimonials = lazy(() => import('./pages/ListTestimonials'));
const Email_verification = lazy(() => import('./pages/Email_verification'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const WelcomeScreen = lazy(() => import('./pages/Welcome'));
const FinanceHome = lazy(() => import('./pages/FinanceHome'));
const FinancePage = lazy(() => import('./pages/finance/FinancePage'));
const MasterData = lazy(() => import('./pages/finance/MasterData'));
const ProjectsList = lazy(() => import('./pages/finance/ProjectsList'));
const NewProjectWizard = lazy(() => import('./pages/finance/NewProjectWizard'));
const ProjectDetail = lazy(() => import('./pages/finance/ProjectDetail'));
const WorkDetail = lazy(() => import('./pages/finance/WorkDetail'));
const ClientsPage = lazy(() => import('./pages/finance/ClientsPage'));
const ClientDetail = lazy(() => import('./pages/finance/ClientDetail'));
const ProcurementPage = lazy(() => import('./pages/finance/ProcurementPage'));
const ContractorsPage = lazy(() => import('./pages/finance/ContractorsPage'));
const SiteOperationsPage = lazy(() => import('./pages/finance/SiteOperationsPage'));
const SiteInventoryPage = lazy(() => import('./pages/finance/SiteInventoryPage'));
const ReceivablesPage = lazy(() => import('./pages/finance/ReceivablesPage'));
const ReceiptsPage = lazy(() => import('./pages/finance/ReceiptsPage'));
const PayablesPage = lazy(() => import('./pages/finance/PayablesPage'));
const PaymentsPage = lazy(() => import('./pages/finance/PaymentsPage'));
const BankPage = lazy(() => import('./pages/finance/BankPage'));
const CashBookPage = lazy(() => import('./pages/finance/CashBookPage'));
const ReportsPage = lazy(() => import('./pages/finance/ReportsPage'));
const EmployeesPage = lazy(() => import('./pages/finance/EmployeesPage'));
const SettingsPage = lazy(() => import('./pages/finance/SettingsPage'));
const FinanceRecoveryBin = lazy(() => import('./pages/finance/FinanceRecoveryBin'));
const DailyLabourPage = lazy(() => import('./pages/finance/DailyLabourPage'));
const ReferralsPage = lazy(() => import('./pages/finance/ReferralsPage'));
const ActivityTimelinePage = lazy(() => import('./pages/finance/ActivityTimelinePage'));
const Guest = lazy(() => import('./pages/guest'));

// Reuses the same loader chrome as the app's existing global isLoading
// overlay, so a lazy route boundary doesn't introduce a visually
// different loading state from the one already used everywhere else.
const RouteLoader = () => (
  <div className="submit-loader-overlay">
    <div className="loader-modal-box">
      <div className="loader-ring"></div>
      <div className="loader-brand">
        <strong>Loading</strong>
        <span>Please wait</span>
      </div>
      <div className="loader-dots">
        <div className="loader-dot"></div>
        <div className="loader-dot"></div>
        <div className="loader-dot"></div>
      </div>
    </div>
  </div>
);

const App = () => {
  const [showLogin, setShowLogin] = useState(false);
  const [autoOpenRequest, setAutoOpenRequest] = useState(false);
  const [autoOpenEmail, setAutoOpenEmail]     = useState('');
  const [autoOpenName, setAutoOpenName]       = useState('');

  // Global 401 interceptor — catches token expiry mid-session on any API call
  useEffect(() => {
    const id = axios.interceptors.response.use(
      res => res,
      err => {
        if (err.response?.status === 401) {
          ['token', 'userId', 'userName', 'userEmail', 'user'].forEach(k => localStorage.removeItem(k));
          window.location.replace('/?reason=expired');
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);
  const [authType, setAuthType] = useState('Login');
  const [isLoading, setIsLoading] = useState(false); // Global loader — renders outside sidebar/main-content
  const url = import.meta.env.VITE_API_URL || "http://localhost:3000";
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  let isAdmin = false;

  try {
    const user = JSON.parse(localStorage.getItem("user"));
  
    isAdmin =
      !!localStorage.getItem("token") &&
      (user?.role === "ADMIN" || user?.role === "MASTER");
  } catch (err) {
    isAdmin = false;
  }

  return (
    <div>
      {/* Global loader — lives at root, outside sidebar & main-content, always true viewport center */}
      {isLoading && (
  <div className="submit-loader-overlay">
    <div className="loader-modal-box">
      <div className="loader-ring"></div>

      <div className="loader-brand">
        <strong>Curating Details</strong>
        <span>Please wait</span>
      </div>

      <div className="loader-dots">
        <div className="loader-dot"></div>
        <div className="loader-dot"></div>
        <div className="loader-dot"></div>
      </div>
    </div>
  </div>
)}

      {showLogin && <Login setShowLogin={setShowLogin} authType={authType} />}

      <ToastContainer
        position="bottom-center"
        autoClose={3500}
        closeOnClick
        pauseOnHover
        draggable={false}
        style={{ zIndex: 999998 }}
      />

      <Navbar setShowLogin={setShowLogin} setAuthType={setAuthType} />

      <div className="app-contents">
        <Sidebar />
        <div className="main-content">
          <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route
              path="/"
              element={
                isAdmin ? (
                  <Navigate to="/welcome" replace />
                ) : (
                  <Guest
                    setShowLogin={setShowLogin}
                    setAuthType={setAuthType}
                    autoOpenRequest={autoOpenRequest}
                    setAutoOpenRequest={setAutoOpenRequest}
                    autoOpenEmail={autoOpenEmail}
                    autoOpenName={autoOpenName}
                  />
                )
              }
            />
            <Route
              path='/welcome'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <WelcomeScreen setShowLogin={setShowLogin} setAuthType={setAuthType} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/add'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <AddDesign url={url} setIsLoading={setIsLoading} isLoading={isLoading} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/list'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ListDesigns url={url} setIsLoading={setIsLoading} isLoading={isLoading} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/add-project'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <AddProject url={url} setIsLoading={setIsLoading} isLoading={isLoading} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/list-projects'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ListProjects url={url} setIsLoading={setIsLoading} isLoading={isLoading} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/add-product'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <AddProduct url={url} setIsLoading={setIsLoading} isLoading={isLoading} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/list-products'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ListProducts url={url} setIsLoading={setIsLoading} isLoading={isLoading} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/admin-requests'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <AdminRequests url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/recovery-bin'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <RecoveryBin url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <FinanceHome url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/masters'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <MasterData url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/projects'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ProjectsList url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/projects/new'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <NewProjectWizard url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/clients'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ClientsPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/procurement'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ProcurementPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/contractors'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ContractorsPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/site-operations'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <SiteOperationsPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/site-inventory'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <SiteInventoryPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/receivables'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ReceivablesPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/receipts'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ReceiptsPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/payables'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <PayablesPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/payments'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <PaymentsPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/bank'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <BankPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/cash-book'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <CashBookPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/reports'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ReportsPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/employees'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <EmployeesPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/daily-labour'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <DailyLabourPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/referrals'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ReferralsPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/activity'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ActivityTimelinePage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/settings'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <SettingsPage url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/recovery-bin'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <FinanceRecoveryBin url={url} />
                </ProtectedRoute>
              }
            />
            {FINANCE_ROUTES.filter(r => ![
              '/finance', '/finance/masters', '/finance/projects', '/finance/projects/new',
              '/finance/clients', '/finance/procurement', '/finance/contractors',
              '/finance/site-operations', '/finance/site-inventory',
              '/finance/receivables', '/finance/receipts',
              '/finance/payables', '/finance/payments',
              '/finance/bank', '/finance/cash-book', '/finance/reports',
              '/finance/employees', '/finance/daily-labour', '/finance/referrals', '/finance/settings',
              '/finance/activity', '/finance/recovery-bin',
            ].includes(r.to)).map(({ to, label, phase, tabs }) => (
              <Route
                key={to}
                path={to}
                element={
                  <ProtectedRoute setShowLogin={setShowLogin}>
                    <FinancePage label={label} phase={phase} tabs={tabs} />
                  </ProtectedRoute>
                }
              />
            ))}
            <Route
              path='/finance/projects/:id'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ProjectDetail url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/clients/:id'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ClientDetail url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/finance/projects/:id/works/:workId'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <WorkDetail url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/my-account'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <MyAccount url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/add-testimonial'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <AddTestimonial url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/list-testimonials'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <ListTestimonials url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/appointments'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <Appointments url={url} setIsLoading={setIsLoading} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/quotes'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <Quotes url={url} setIsLoading={setIsLoading} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/verify-email'
              element={
                <Email_verification
                  setShowLogin={setShowLogin}
                  setAuthType={setAuthType}
                  setAutoOpenRequest={setAutoOpenRequest}
                  setAutoOpenEmail={setAutoOpenEmail}
                  setAutoOpenName={setAutoOpenName}
                />
              }
            />
            <Route path='/pending' element={<PendingApproval />} />
            <Route
              path='/reset-password/:token'
              element={<ResetPassword setShowLogin={setShowLogin} />}
            />
          </Routes>
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default App;