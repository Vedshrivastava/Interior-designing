import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHouse, 
  faPenRuler, 
  faCubes, 
  faDiagramProject, 
  faHandshake 
} from '@fortawesome/free-solid-svg-icons';
import '../styles/bottomNavbar.css';

const BottomNavbar = ({ setShowLogin }) => {
  const navigate  = useNavigate();
  const location  = useLocation();

  const isDesignActive = location.pathname.startsWith('/design');

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">

      <NavLink to="/" end className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
        <span className="bn-icon"><FontAwesomeIcon icon={faHouse} /></span>
        <span className="bn-label">Home</span>
      </NavLink>

      <button
        className={`bn-item${isDesignActive ? ' active' : ''}`}
        onClick={() => navigate('/design/Kitchen%20Designs')}
        aria-label="Designs"
      >
        <span className="bn-icon"><FontAwesomeIcon icon={faPenRuler} /></span>
        <span className="bn-label">Designs</span>
      </button>

      <NavLink to="/products" className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
        <span className="bn-icon"><FontAwesomeIcon icon={faCubes} /></span>
        <span className="bn-label">Products</span>
      </NavLink>

      <NavLink to="/projects" className={({ isActive }) => `bn-item${isActive ? ' active' : ''}`}>
        <span className="bn-icon"><FontAwesomeIcon icon={faDiagramProject} /></span>
        <span className="bn-label">Projects</span>
      </NavLink>

      <button
        className="bn-item bn-item--cta"
        onClick={() => setShowLogin(true)}
        aria-label="Book consultation"
      >
        <span className="bn-icon"><FontAwesomeIcon icon={faHandshake} /></span>
        <span className="bn-label">Consult</span>
      </button>

    </nav>
  );
};

export default BottomNavbar;