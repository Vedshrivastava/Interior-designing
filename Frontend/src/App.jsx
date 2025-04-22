import { useState } from 'react';
import './App.css';
import Home from './pages/Home';
import Consult from './components/consult';
import { Route, Routes } from 'react-router-dom';
import DesignDisplay from './pages/designDisplay';
import About from './pages/About';
import Contact from './pages/Contact';
import Projects from './pages/Projects';
import Services from './pages/Services'; // ✅ Newly added import

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [consultData, setConsultData] = useState({ name: '', img: '' }); // State to hold design name and image

  return (
    <>
      {showLogin && <Consult setShowLogin={setShowLogin} consultData={consultData} setConsultData={setConsultData} />} {/* Pass name and img to Consult */}
      <Routes>
        <Route path='/' element={<Home setShowLogin={setShowLogin} />} />
        <Route path="/design/:category" element={<DesignDisplay setShowLogin={setShowLogin} setConsultData={setConsultData} consultData={consultData} />} />
        <Route path='/about' element={<About setShowLogin={setShowLogin} />} />
        <Route path='/contact' element={<Contact setShowLogin={setShowLogin} />} />
        <Route path='/projects' element={<Projects setShowLogin={setShowLogin} />} />
        <Route path='/services' element={<Services setShowLogin={setShowLogin} />} /> {/* ✅ New Route */}
      </Routes>
    </>
  );
}

export default App;
