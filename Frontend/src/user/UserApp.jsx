import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Consult from "./components/consult";
import DesignDisplay from "./pages/designDisplay";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Projects from "./pages/Projects";
import Services from "./pages/Services";
import "../App.css";

function UserApp() {
  const [showLogin, setShowLogin] = useState(false);
  const [consultData, setConsultData] = useState({ name: "", img: "" });

  return (
    <>
      {showLogin && (
        <Consult
          setShowLogin={setShowLogin}
          consultData={consultData}
          setConsultData={setConsultData}
        />
      )}
      <Routes>
        <Route path="/" element={<Home setShowLogin={setShowLogin} />} />
        <Route
          path="/design/:category"
          element={
            <DesignDisplay
              setShowLogin={setShowLogin}
              setConsultData={setConsultData}
              consultData={consultData}
            />
          }
        />
        <Route path="/about" element={<About setShowLogin={setShowLogin} />} />
        <Route
          path="/contact"
          element={<Contact setShowLogin={setShowLogin} />}
        />
        <Route
          path="/projects"
          element={<Projects setShowLogin={setShowLogin} />}
        />
        <Route
          path="/services"
          element={<Services setShowLogin={setShowLogin} />}
        />
      </Routes>
    </>
  );
}

export default UserApp;
