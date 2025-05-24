import React, { useState } from "react";
import Navbar from "./components/Navbar";
import Sidebar from "./components/sidebar";
import { Routes, Route } from "react-router-dom";
import Add from "./pages/Add";
import List from "./pages/List";
import Orders from "./pages/Orders";
import Quotes from "./pages/Quotes";
import Email_verification from "./pages/Email_verification";
import ResetPassword from "./pages/ResetPassword";
import Login from "./components/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../index.css";

const AdminApp = () => {
  const [showLogin, setShowLogin] = useState(false);
  const url = "http://localhost:3000";

  return (
    <div>
      {showLogin && <Login setShowLogin={setShowLogin} />}
      <ToastContainer />
      <Navbar setShowLogin={setShowLogin} />
      <div className="app-contents">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route
              path="/add"
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <Add url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/list"
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <List url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <Orders url={url} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quotes"
              element={
                <ProtectedRoute setShowLogin={setShowLogin}>
                  <Quotes url={url} />
                </ProtectedRoute>
              }
            />
            <Route path="/verify-email" element={<Email_verification />} />
            <Route
              path="/reset-password/:token"
              element={<ResetPassword setShowLogin={setShowLogin} />}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default AdminApp;
