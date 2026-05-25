import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/designDisplay.css';
import Design from '../components/Design';
import Footer from '../components/Footer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette, faLayerGroup } from '@fortawesome/free-solid-svg-icons';

const CATEGORIES = [
  'Kitchen Designs',
  'Bedroom Designs',
  'Bathroom Designs',
  'Lounge area Designs',
  'TV Unit Designs',
  'Kids Room Designs',
  'Commercial Designs',
  'House Exterior',
  'Mandir Designs',
  'Garden Designs',
];

const LABELS = {
  'Kitchen Designs':    'Kitchen',
  'Bedroom Designs':   'Bedroom',
  'Bathroom Designs':  'Bathroom',
  'Lounge area Designs':'Lounge',
  'TV Unit Designs':   'TV Unit',
  'Kids Room Designs': 'Kids Room',
  'Commercial Designs':'Commercial',
  'House Exterior':    'Exterior',
  'Mandir Designs':    'Mandir',
  'Garden Designs':    'Garden',
};

const DesignDisplay = ({ setShowLogin, setConsultData, consultData }) => {
  const url = "http://localhost:3000";
  const { category } = useParams();
  const [designList, setDesignList] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(category || CATEGORIES[0]);
  const mobileBarRef = useRef(null);

  useEffect(() => {
    const fetchDesignList = async () => {
      try {
        const response = await axios.get(`${url}/api/design/list?category=${currentCategory}`);
        setDesignList(response.data.data);
      } catch (error) {
        console.error("Error fetching design list:", error);
      }
    };
    fetchDesignList();
  }, [currentCategory]);

  /* keep active mobile chip in view */
  useEffect(() => {
    if (!mobileBarRef.current) return;
    const active = mobileBarRef.current.querySelector('.dd-cat-chip.active');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [currentCategory]);

  const handleCategory = (cat) => setCurrentCategory(cat);

  const visibleDesigns = designList.filter(
    item => currentCategory === 'All' || currentCategory === item.category
  );

  /* short display name for the header */
  const displayName = LABELS[currentCategory] || currentCategory;

  return (
    <div>
      <div className="design-display-main" id="design-display">

        {/* ── PAGE HEADER ── */}
        <div className="dd-header">
          <div className="dd-header-inner">

            <div className="dd-header-left">
              <div className="dd-overline">
                <FontAwesomeIcon icon={faPalette} /> Our Designs
              </div>
              <h1>{displayName}</h1>
            </div>

            <div className="dd-header-right">
              <p>
                Explore our curated collection of {displayName.toLowerCase()} — each
                crafted with premium materials, precision and timeless elegance.
              </p>
              <div className="dd-count-badge">
                <FontAwesomeIcon icon={faLayerGroup} />
                {visibleDesigns.length} design{visibleDesigns.length !== 1 ? 's' : ''}
              </div>
            </div>

          </div>
        </div>

        {/* ── DESKTOP STICKY CATEGORY BAR ── */}
        <nav className="dd-category-bar" aria-label="Design categories">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`dd-cat-pill${currentCategory === cat ? ' active' : ''}`}
              onClick={() => handleCategory(cat)}
            >
              {LABELS[cat]}
            </button>
          ))}
        </nav>

        {/* ── MOBILE SCROLL CHIPS ── */}
        <div className="dd-cat-mobile" ref={mobileBarRef}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`dd-cat-chip${currentCategory === cat ? ' active' : ''}`}
              onClick={() => handleCategory(cat)}
            >
              {LABELS[cat]}
            </button>
          ))}
        </div>

        {/* ── DESIGN GRID ── */}
        <div className="dd-body">
          <div className="design-display-list">
            {visibleDesigns.length > 0 ? (
              visibleDesigns.map((item) => (
                <Design
                  key={item._id}
                  id={item._id}
                  name={item.name}
                  description={item.description}
                  images={item.images}
                  points={item.points}
                  setShowLogin={setShowLogin}
                  setConsultData={setConsultData}
                  consultData={consultData}
                />
              ))
            ) : (
              <div className="dd-empty">
                <div className="dd-empty-icon">
                  <FontAwesomeIcon icon={faPalette} />
                </div>
                <h3>No designs yet</h3>
                <p>We're adding new {displayName.toLowerCase()} soon. Check back shortly.</p>
              </div>
            )}
          </div>
        </div>

      </div>
      <Footer />
    </div>
  );
};

export default DesignDisplay;
