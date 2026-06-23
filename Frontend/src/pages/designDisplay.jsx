import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/designDisplay.css';
import Design from '../components/Design';
import Footer from '../components/Footer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPalette, faLayerGroup, faStar } from '@fortawesome/free-solid-svg-icons';

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
  'Kitchen Designs': 'Kitchen',
  'Bedroom Designs': 'Bedroom',
  'Bathroom Designs': 'Bathroom',
  'Lounge area Designs': 'Lounge',
  'TV Unit Designs': 'TV Unit',
  'Kids Room Designs': 'Kids Room',
  'Commercial Designs': 'Commercial',
  'House Exterior': 'Exterior',
  'Mandir Designs': 'Mandir',
  'Garden Designs': 'Garden',
};

const DesignDisplay = ({ setShowLogin, setShowQuotePopup, setConsultData, consultData }) => {
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

  const displayName = LABELS[currentCategory] || currentCategory;

  const categoryDesigns = designList
    .filter(item => item.category === currentCategory)
    .reverse();

  const featuredDesigns = categoryDesigns.filter(item => item.isFeatured);
  const regularDesigns = categoryDesigns.filter(item => !item.isFeatured);

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
                {categoryDesigns.length} design{categoryDesigns.length !== 1 ? 's' : ''}
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

        {/* ── FEATURED SECTION ── */}
        {featuredDesigns.length > 0 && (
          <section className="dd-featured-section">

            {/* Section header */}
            <div className="dd-featured-header">
              <div className="dd-featured-header-left">
                <span className="dd-featured-overline">
                  <FontAwesomeIcon icon={faStar} /> Featured Picks
                </span>
                <h2 className="dd-featured-heading">Handpicked for You</h2>
              </div>
              <p className="dd-featured-subtext">
                Our team's top selections — standout designs with exceptional detailing and finish.
              </p>
            </div>

            {/* Featured card grid — same structure as regular grid */}
            <div className="dd-featured-grid">
              {featuredDesigns.map((item) => (
                <div key={item._id} className="dd-featured-card-wrap">
                  {/* Featured ribbon */}
                  <div className="dd-featured-ribbon">
                    <FontAwesomeIcon icon={faStar} />
                    Featured
                  </div>
                  <Design
                    id={item._id}
                    name={item.name}
                    description={item.description}
                    images={item.images}
                    points={item.points}
                    setShowLogin={setShowLogin}
                    setConsultData={setConsultData}
                    consultData={consultData}
                    setShowQuotePopup={setShowQuotePopup}
                    category={item.category}
                  />
                </div>
              ))}
            </div>

          </section>
        )}

        {/* ── DESIGN GRID ── */}
        <div className="dd-body">
          {regularDesigns.length > 0 && featuredDesigns.length > 0 && (
            <div className="dd-section-label">
              All Designs
            </div>
          )}
          <div className="design-display-list">
            {categoryDesigns.length > 0 ? (
              regularDesigns.map((item) => (
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
                  setShowQuotePopup={setShowQuotePopup}
                  category={item.category}
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
