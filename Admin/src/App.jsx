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
import ProtectedRoute from './components/ProtectedRoute'; // Importing ProtectedRoute
import Email_verification from './pages/Email_verification'
import ResetPassword from './pages/ResetPassword';

const App = () => {
  const [showLogin, setShowLogin] = useState(false); // For managing login modal
  const url = "http://localhost:3000"; // Updated to match previous setup

  return (
    <div>
      {showLogin && <Login setShowLogin={setShowLogin} />} {/* Conditionally show Login */}

      <ToastContainer /> {/* Toast notifications */}
      <Navbar setShowLogin={setShowLogin} /> {/* Pass setShowLogin to Navbar */}

      <div className="app-contents">
        <Sidebar />
        <div className="main-content">
          <Routes>
            {/* Protected routes with login handling */}
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
            <Route path='/verify-email' element={
                <Email_verification />
            } />
            <Route path='/reset-password/:token' element={
              <ResetPassword setShowLogin={setShowLogin} />
            } />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default App;
