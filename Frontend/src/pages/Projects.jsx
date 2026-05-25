import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/projects.css';
import Design from '../components/Design';
import Footer from '../components/Footer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faLayerGroup, faCalendarCheck, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';

const Projects = ({ setShowLogin }) => {
  // 1. UPDATE THIS to your computer's local IP for mobile testing
  // e.g., "http://192.168.1.X:3000"
  const url = "http://localhost:3000"; 
  const [designList, setDesignList] = useState([]);

  useEffect(() => {
    const fetchDesignList = async () => {
      try {
        const response = await axios.get(`${url}/api/design/list?category=Projects`);
        setDesignList(response.data.data);
      } catch (error) {
        console.error("Error fetching design list:", error);
      }
    };
    fetchDesignList();
  }, [url]);

  return (
    // Removed the unnecessary extra <div> wrapper here
    <div className="project-display" id="project-display">

      {/* ── PAGE HEADER ── */}
      <div className="project-header">
        <div className="project-header-inner">

          <div className="project-header-left">
            <div className="proj-overline">
              <FontAwesomeIcon icon={faBuilding} /> Portfolio
            </div>
            <h2 className="project-heading">Recent Projects</h2>
          </div>

          <div className="project-header-right">
            <p className="project-main-para">
              A showcase of our finest work — each project a testament to
              precision craftsmanship, premium materials and timeless design.
            </p>
            <div className="proj-count-badge">
              <FontAwesomeIcon icon={faLayerGroup} />
              {designList.length} project{designList.length !== 1 ? 's' : ''}
            </div>
          </div>

        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="proj-stats">
        {[
          { val: '50+',  label: 'Projects Completed' },
          { val: '5+',   label: 'Years Experience'   },
          { val: '100%', label: 'Client Satisfaction' },
        ].map((s, i) => (
          <div className="proj-stat-item" key={i}>
            <h3>{s.val}</h3>
            <p>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── PROJECTS GRID ── */}
      <div className="proj-body">
        <div className="project-display-list">
          {designList.length > 0 ? (
            designList.map((item) => (
              <Design
                key={item._id}
                id={item._id}
                name={item.name}
                description={item.description}
                images={item.images}
                points={item.points}
                setShowLogin={setShowLogin}
              />
            ))
          ) : (
            <div className="proj-empty">
              <div className="proj-empty-icon">
                <FontAwesomeIcon icon={faBuilding} />
              </div>
              <h3>Projects coming soon</h3>
              <p>We're uploading our latest work. Check back shortly.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA STRIP ── */}
      <div className="proj-cta">
        <div className="proj-cta-inner">
          <div className="proj-cta-overline">
            <FontAwesomeIcon icon={faWandMagicSparkles} /> Begin Your Journey
          </div>
          <h2>Love What You See?</h2>
          <p>
            Let's bring the same level of craft and care to your home.
            Book a free consultation and we'll take it from there.
          </p>
          <button className="proj-cta-btn" onClick={() => setShowLogin(true)}>
            Book Free Consultation <FontAwesomeIcon icon={faCalendarCheck} />
          </button>
        </div>
      </div>

      {/* 2. MOVED FOOTER INSIDE THE WRAPPER */}
      <Footer />

    </div>
  );
};

export default Projects;