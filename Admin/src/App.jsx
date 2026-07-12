import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from './components/Navbar';
import Sidebar from './components/sidebar';
import { Routes, Route } from 'react-router-dom';
import AddDesign    from './pages/AddDesign';
import ListDesigns  from './pages/ListDesigns';
import Appointments from './pages/Appointments';
import Quotes from './pages/Quotes';
import AddProject from './pages/AddProject';
import ListProjects from './pages/ListProjects';
import MyAccount      from './pages/MyAccount';
import AdminRequests  from './pages/AdminRequests';
import RecoveryBin    from './pages/RecoveryBin';
import AddProduct from './pages/AddProduct';
import ListProducts from './pages/ListProducts';
import AddTestimonial   from './pages/AddTestimonial';
import ListTestimonials from './pages/ListTestimonials';
import './index.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Email_verification from './pages/Email_verification';
import ResetPassword from './pages/ResetPassword';
import PendingApproval from './pages/PendingApproval';
import WelcomeScreen from './pages/Welcome';
import FinanceHome from './pages/FinanceHome';
import FinancePage from './pages/finance/FinancePage';
import MasterData from './pages/finance/MasterData';
import ProjectsList from './pages/finance/ProjectsList';
import NewProjectWizard from './pages/finance/NewProjectWizard';
import ProjectDetail from './pages/finance/ProjectDetail';
import ClientsPage from './pages/finance/ClientsPage';
import ClientDetail from './pages/finance/ClientDetail';
import ProcurementPage from './pages/finance/ProcurementPage';
import ContractorsPage from './pages/finance/ContractorsPage';
import SiteOperationsPage from './pages/finance/SiteOperationsPage';
import SiteInventoryPage from './pages/finance/SiteInventoryPage';
import ReceivablesPage from './pages/finance/ReceivablesPage';
import ReceiptsPage from './pages/finance/ReceiptsPage';
import { FINANCE_ROUTES } from './config/financeNav';
import Guest from './pages/guest';
import { Navigate } from "react-router-dom";

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
            {FINANCE_ROUTES.filter(r => ![
              '/finance', '/finance/masters', '/finance/projects', '/finance/projects/new',
              '/finance/clients', '/finance/procurement', '/finance/contractors',
              '/finance/site-operations', '/finance/site-inventory',
              '/finance/receivables', '/finance/receipts',
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
        </div>
      </div>
    </div>
  );
};

export default App;