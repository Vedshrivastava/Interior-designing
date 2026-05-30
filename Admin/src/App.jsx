import React, { useState } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/sidebar';
import { Routes, Route } from 'react-router-dom';
import Add from './pages/Add';
import List from './pages/List';
import Orders from './pages/Orders';
import Quotes from './pages/Quotes';
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
  const [showLogin, setShowLogin] = useState(false); // For managing login modal visibility
  const [authType, setAuthType] = useState('Login'); // For managing 'Login' vs 'SignUp' view
  const url = "http://localhost:3000";
  const storedUser = localStorage.getItem("user");
  const user = storedUser ? JSON.parse(storedUser) : null;

  const isAdmin =
    localStorage.getItem("token") &&
    user?.role === "ADMIN";

  return (
    <div>
      {/* 1. Passed authType to Login modal so it knows which form to render */}
      {showLogin && <Login setShowLogin={setShowLogin} authType={authType} />}

      <ToastContainer position="bottom-center" />

      {/* 2. Passed setAuthType to Navbar in case you have separate "Login"/"Sign Up" buttons there */}
      <Navbar setShowLogin={setShowLogin} setAuthType={setAuthType} />

      <div className="app-contents">
        <Sidebar />
        <div className="main-content">
          <Routes>
            {/* 3. Passed both setters to Guest and Welcome screens so landing page buttons work */}
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

            {/* Protected routes */}
            <Route
              path='/add'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <Add url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/list'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <List url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/appointments'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <Orders url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path='/quotes'
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <Quotes url={url} />
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