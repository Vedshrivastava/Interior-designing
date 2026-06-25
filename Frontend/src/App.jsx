import { useState } from 'react';
import './App.css';
import { Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
// Note: Ensure you still have import 'react-toastify/dist/ReactToastify.css'; 
// either at the top of this file or inside your index.css / main.jsx!

import Home from './pages/Home';
import NotFound from './pages/NotFound';
import About from './pages/About';
import Contact from './pages/Contact';
import Projects from './pages/Projects';
import Services from './pages/Services';
import DesignDisplay from './pages/designDisplay';
import Products from './pages/Products';

import Consult from './components/consult';
import QuotePopup from './components/quote-popup';
import MainNavbar from './components/mainNavbar';
import BottomNavbar from './components/BottomNavbar';

function App() {
  // Separate states for the two different popups
  const [showLogin, setShowLogin] = useState(false); 
  const [showQuotePopup, setShowQuotePopup] = useState(false); 
  
  // Changed initial state to null so conditional rendering works cleanly
  const [consultData, setConsultData] = useState(null); 

  return (
    <>
      <MainNavbar setShowLogin={setShowLogin} />
      <BottomNavbar setShowLogin={setShowLogin} />

      {/* MODAL 1: Standard Free Consultation */}
      {showLogin && (
        <Consult
          setShowLogin={setShowLogin}
        />
      )}

      {/* MODAL 2: Specific Design Quote */}
      {showQuotePopup && (
        <QuotePopup
          setShowQuotePopup={setShowQuotePopup}
          consultData={consultData}
          setConsultData={setConsultData}
        />
      )}

      {/* ROUTES */}
      <Routes>
        <Route path='/' element={<Home setShowLogin={setShowLogin} />} />

        <Route
          path="/design/:category"
          element={
            <DesignDisplay
              setShowLogin={setShowLogin} // Kept in case you have generic consult buttons there
              setShowQuotePopup={setShowQuotePopup} // NEW: Passed to handle "Get Quote" clicks
              setConsultData={setConsultData}
              consultData={consultData}
            />
          }
        />

        <Route path='/about'    element={<About    setShowLogin={setShowLogin} />} />
        <Route path='/contact'  element={<Contact  setShowLogin={setShowLogin} />} />
        <Route path='/projects' element={<Projects setShowLogin={setShowLogin} />} />
        <Route path='/services' element={<Services setShowLogin={setShowLogin} />} />
        <Route path='/products' element={<Products setShowLogin={setShowLogin} />} />
        <Route path='*' element={<NotFound />} />
      </Routes>

      {/* GLOBAL FLOATING WHATSAPP BUTTON */}
      <a
        href="https://wa.me/918962053372"
        target="_blank"
        rel="noopener noreferrer"
        className="wa-fab"
        aria-label="Chat with us on WhatsApp"
      >
        <span className="wa-fab-pulse" />
        <FontAwesomeIcon icon={faWhatsapp} className="wa-fab-icon" />
        <span className="wa-fab-label">Chat with us</span>
      </a>

      {/* GLOBAL TOAST CONTAINER */}
      <ToastContainer
        position="bottom-center"
        autoClose={3000}
        theme="dark"
      />
    </>
  );
}

export default App;
