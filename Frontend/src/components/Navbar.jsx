import React, { useState } from 'react';
import '../styles/navbar.css';
import {Link} from 'react-router-dom'

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">InteriorDesign</div>
        <div className={`navbar-links-container ${isOpen ? 'open' : ''}`}>
          <ul className="navbar-links">
            <li><a href="/">Home</a></li>
            <li><a href="#services">Services</a></li>
            <li><Link to="/projects">Projects</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/contact">Contact</Link></li>
          </ul>
        </div>
        <div className="hamburger" onClick={toggleDropdown}>
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
