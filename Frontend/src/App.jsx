import { useState } from 'react';
import './App.css';
import { Route, Routes } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
// Note: Ensure you still have import 'react-toastify/dist/ReactToastify.css'; 
// either at the top of this file or inside your index.css / main.jsx!

import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Projects from './pages/Projects';
import Services from './pages/Services';
import DesignDisplay from './pages/designDisplay';

import Consult from './components/consult';
import QuotePopup from './components/quote-popup'; // NEW: Imported the new Quote popup
import MainNavbar from './components/mainNavbar';

function App() {
  // Separate states for the two different popups
  const [showLogin, setShowLogin] = useState(false); 
  const [showQuotePopup, setShowQuotePopup] = useState(false); 
  
  // Changed initial state to null so conditional rendering works cleanly
  const [consultData, setConsultData] = useState(null); 

  return (
    <>
      <MainNavbar setShowLogin={setShowLogin} />

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

        <Route path='/about' element={<About setShowLogin={setShowLogin} />} />
        <Route path='/contact' element={<Contact setShowLogin={setShowLogin} />} />
        <Route path='/projects' element={<Projects setShowLogin={setShowLogin} />} />
        <Route path='/services' element={<Services setShowLogin={setShowLogin} />} />
      </Routes>

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