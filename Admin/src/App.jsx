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
import './index.css';
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Email_verification from './pages/Email_verification';
import ResetPassword from './pages/ResetPassword';
import WelcomeScreen from './pages/Welcome';
import Guest from './pages/guest';
import { Navigate } from "react-router-dom";

const App = () => {
  const [showLogin, setShowLogin] = useState(false);

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

      <ToastContainer position="bottom-center" />

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
              path='/my-account'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <MyAccount url={url} />
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
            <Route path='/verify-email' element={<Email_verification />} />
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