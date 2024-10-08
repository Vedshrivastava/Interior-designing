import { useState } from 'react';
import './App.css';
import Home from './pages/Home';
import Consult from './components/consult';
import { Route, Routes } from 'react-router-dom';
import DesignDisplay from './pages/designDisplay';
import About from './pages/About';
import Contact from './pages/Contact';
import Projects from './pages/Projects';

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [consultData, setConsultData] = useState({ name: '', img: '' }); // State to hold design name and image

  return (
    <>
      {showLogin && <Consult setShowLogin={setShowLogin} consultData={consultData} setConsultData={setConsultData}/>} {/* Pass name and img to Consult */}
      <Routes>
        <Route path='/' element={<Home setShowLogin={setShowLogin} />} ></Route>
        <Route path="/design/:category" element={<DesignDisplay setShowLogin={setShowLogin} setConsultData={setConsultData} consultData={consultData} />}></Route> {/* Pass setConsultData */}
        <Route path='/about' element={<About setShowLogin={setShowLogin} />} ></Route>
        <Route path='/contact' element={<Contact setShowLogin={setShowLogin} />} ></Route>
        <Route path='/projects' element={<Projects setShowLogin={setShowLogin} />} ></Route>
      </Routes>
    </>
  )
}

export default App;
