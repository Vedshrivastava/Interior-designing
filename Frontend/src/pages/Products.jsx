import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import '../styles/productsPage.css';
import { useWebSocket } from '../hooks/useWebSocket';
import Footer from '../components/Footer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStore, faLayerGroup, faCalendarCheck, faCrown,
  faChevronLeft, faChevronRight, faStar, faCircleInfo,
  faDroplet, faSun, faFire, faCloudRain, faLeaf, faWrench,
  faShieldHalved, faVolumeXmark, faTemperatureHalf, faShield,
  faPen, faCheck, faLayerGroup as faLayer,
} from '@fortawesome/free-solid-svg-icons';

/* ─── Constants ──────────────────────────────────────────────── */
const SUBCATEGORIES = {
  'Interior':               ['Ceilings', 'Wall Features', 'Flooring', 'Lighting', 'Furniture'],
  'Exterior':               ['Facades', 'Cladding', 'Landscaping', 'Pergolas'],
  'Functional Architecture':['Breeze Blocks', 'Jaali Walls', 'Decorative Screens', 'Feature Walls', 'Privacy Screens'],
};
const CATEGORIES = Object.keys(SUBCATEGORIES);

const SPEC_META = {
  'Waterproof':         { icon: faDroplet,        color: '#3b82f6' },
  'UV Protection':      { icon: faSun,            color: '#f59e0b' },
  'Fire Resistant':     { icon: faFire,           color: '#ef4444' },
  'Weather Resistant':  { icon: faCloudRain,      color: '#6366f1' },
  'Eco-Friendly':       { icon: faLeaf,           color: '#22c55e' },
  'Low Maintenance':    { icon: faWrench,         color: '#8b5cf6' },
  'Anti-Fungal':        { icon: faShieldHalved,   color: '#14b8a6' },
  'Sound Insulation':   { icon: faVolumeXmark,    color: '#ec4899' },
  'Thermal Insulation': { icon: faTemperatureHalf,color: '#f97316' },
  'Scratch Resistant':  { icon: faShield,         color: '#64748b' },
  'Fade Resistant':     { icon: faSun,            color: '#a78bfa' },
  'Customizable':       { icon: faPen,            color: '#c9a87c' },
  'Non-Toxic':          { icon: faLeaf,           color: '#10b981' },
  'Rust Resistant':     { icon: faShieldHalved,   color: '#78716c' },
};

/* ─── ProductCard ─────────────────────────────────────────────── */
const ProductCard = ({ product, setShowLogin }) => {
  const [modalOpen,   setModalOpen]   = useState(false);
  const [activeThumb, setActiveThumb] = useState(0);
  const [lbIdx,       setLbIdx]       = useState(null);

  const {
    name, description, images = [], category, subcategory,
    material, finish, specialities = [], applications = [],
    points = [], isFeatured,
  } = product;

  const openModal  = () => { setModalOpen(true);  document.body.style.overflow = 'hidden'; };
  const closeModal = useCallback(() => {
    setModalOpen(false); setActiveThumb(0); setLbIdx(null);
    document.body.style.overflow = '';
  }, []);

  const openLb  = (i) => setLbIdx(i);
  const closeLb = useCallback(() => setLbIdx(null), []);
  const lbPrev  = useCallback((e) => { e.stopPropagation(); setLbIdx(i => (i - 1 + images.length) % images.length); }, [images.length]);
  const lbNext  = useCallback((e) => { e.stopPropagation(); setLbIdx(i => (i + 1) % images.length); }, [images.length]);

  useEffect(() => {
    if (lbIdx === null && !modalOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape')     { lbIdx !== null ? closeLb() : closeModal(); }
      if (lbIdx !== null) {
        if (e.key === 'ArrowLeft')  setLbIdx(i => (i - 1 + images.length) % images.length);
        if (e.key === 'ArrowRight') setLbIdx(i => (i + 1) % images.length);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lbIdx, modalOpen, images.length, closeModal, closeLb]);

  /* ── Card ── */
  const card = (
    <div className="prod-card">
      <div className="prod-card-img-wrap" onClick={() => openLb(0)}>
        <img src={images[0]} alt={name} loading="lazy" />
        {images.length > 1 && <div className="prod-card-img-count">+{images.length - 1}</div>}
        <div className="prod-card-img-overlay"><span>View Images</span></div>
        {isFeatured && (
          <div className="prod-card-featured-ribbon">
            <FontAwesomeIcon icon={faStar} /> Featured
          </div>
        )}
      </div>

      <div className="prod-card-body">
        <div className="prod-card-tags">
          <span className="prod-card-cat-tag">{category}</span>
          {subcategory && <span className="prod-card-subcat-tag">{subcategory}</span>}
        </div>

        <h3 className="prod-card-title">{name}</h3>
        <p className="prod-card-desc">{description}</p>

        {(material || finish) && (
          <div className="prod-card-chips">
            {material && <span className="prod-chip"><FontAwesomeIcon icon={faLayerGroup} />{material}</span>}
            {finish   && <span className="prod-chip"><FontAwesomeIcon icon={faStar} />{finish}</span>}
          </div>
        )}

        <button className="prod-card-btn" onClick={openModal}>See Details →</button>
      </div>
    </div>
  );

  /* ── Modal ── */
  const modal = modalOpen && ReactDOM.createPortal(
    <div className="prod-modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true" aria-label={name}>
      <div className="prod-modal" onClick={e => e.stopPropagation()}>

        {/* Close — on modal container so it never scrolls away */}
        <button className="prod-modal-close" onClick={closeModal} aria-label="Close">✕</button>

        {/* Left — gallery */}
        <div className="prod-modal-gallery">
          <div className="prod-modal-main-img-wrap" onClick={() => openLb(activeThumb)}>
            <img src={images[activeThumb]} alt={`${name} — ${activeThumb + 1}`} className="prod-modal-main-img" />
            <div className="prod-modal-img-hint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </div>
          </div>
          {images.length > 1 && (
            <div className="prod-modal-thumbs">
              {images.map((src, i) => (
                <button key={i} className={`prod-modal-thumb${i === activeThumb ? ' active' : ''}`}
                  onClick={() => setActiveThumb(i)} aria-label={`Image ${i + 1}`}>
                  <img src={src} alt={`Thumb ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right — content */}
        <div className="prod-modal-content">
          <div className="prod-modal-tag-row">
            <span className="prod-modal-tag">{category}</span>
            {subcategory && <span className="prod-modal-tag prod-modal-tag--sub">{subcategory}</span>}
          </div>

          <h2 className="prod-modal-title">{name}</h2>

          {(material || finish) && (
            <div className="prod-modal-meta-chips">
              {material && (
                <span className="prod-meta-chip">
                  <FontAwesomeIcon icon={faLayerGroup} /> {material}
                </span>
              )}
              {finish && (
                <span className="prod-meta-chip">
                  <FontAwesomeIcon icon={faCircleInfo} /> {finish}
                </span>
              )}
            </div>
          )}

          {description && (
            <div className="prod-modal-section">
              <h4 className="prod-modal-section-label">About this product</h4>
              <p className="prod-modal-desc">{description}</p>
            </div>
          )}

          {specialities.length > 0 && (
            <div className="prod-modal-section">
              <h4 className="prod-modal-section-label">Specialities</h4>
              <div className="prod-spec-badges">
                {specialities.map((spec, i) => {
                  const meta = SPEC_META[spec] || { icon: faCheck, color: '#c9a87c' };
                  return (
                    <span key={i} className="prod-spec-badge" style={{
                      background: `${meta.color}18`,
                      border: `1px solid ${meta.color}4d`,
                      color: meta.color,
                    }}>
                      <FontAwesomeIcon icon={meta.icon} />
                      {spec}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {applications.length > 0 && (
            <div className="prod-modal-section">
              <h4 className="prod-modal-section-label">Applications</h4>
              <div className="prod-app-chips">
                {applications.map((app, i) => (
                  <span key={i} className="prod-app-chip">
                    <FontAwesomeIcon icon={faCheck} />
                    {app}
                  </span>
                ))}
              </div>
            </div>
          )}

          {points.length > 0 && (
            <div className="prod-modal-section">
              <h4 className="prod-modal-section-label">Key highlights</h4>
              <ul className="prod-modal-points">
                {points.map((pt, i) => (
                  <li key={i} className="prod-modal-point">
                    <span className="prod-point-dot" aria-hidden="true" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="prod-modal-cta">
            <button className="prod-modal-cta-btn" onClick={() => { closeModal(); setShowLogin(true); }}>
              Get Free Consultation <FontAwesomeIcon icon={faCalendarCheck} />
            </button>
            <p className="prod-modal-cta-note">Our team will help you choose and source the right products for your project.</p>
            <button className="prod-modal-close-btn" onClick={closeModal}>Close</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  /* ── Lightbox ── */
  const lightbox = lbIdx !== null && ReactDOM.createPortal(
    <div className="prod-lb-overlay" onClick={closeLb}>
      <button className="prod-lb-close" onClick={closeLb} aria-label="Close">✕</button>
      {images.length > 1 && <button className="prod-lb-arrow prod-lb-arrow--prev" onClick={lbPrev}>&#8249;</button>}
      <div className="prod-lb-img-wrap" onClick={e => e.stopPropagation()}>
        <img src={images[lbIdx]} alt={`${name} — ${lbIdx + 1}`} className="prod-lb-img" />
        <div className="prod-lb-caption">
          <span>{name}</span>
          {images.length > 1 && <span>{lbIdx + 1} / {images.length}</span>}
        </div>
      </div>
      {images.length > 1 && <button className="prod-lb-arrow prod-lb-arrow--next" onClick={lbNext}>&#8250;</button>}
    </div>,
    document.body
  );

  return <>{card}{modal}{lightbox}</>;
};

/* ─── Products page ───────────────────────────────────────────── */
const Products = ({ setShowLogin }) => {
  const url = 'http://localhost:3000';
  const [products,          setProducts]          = useState([]);
  const [loading,           setLoading]           = useState(true);
  const [activeCategory,    setActiveCategory]    = useState('All');
  const [activeSubcategory, setActiveSubcategory] = useState('All');

  const fetchProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${url}/api/product/list`);
      if (res.data.success) setProducts(res.data.data);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Refetch silently when admin changes products
  useWebSocket(useCallback((msg) => {
    if (msg.type === 'productsChanged') fetchProducts();
  }, [fetchProducts]));

  const handleCategoryChange = (cat) => {
    setActiveCategory(cat);
    setActiveSubcategory('All');
  };

  const filtered = products
    .filter(p => activeCategory === 'All' || p.category === activeCategory)
    .filter(p => activeSubcategory === 'All' || p.subcategory === activeSubcategory)
    .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));

  const subcats = activeCategory !== 'All' ? SUBCATEGORIES[activeCategory] || [] : [];

  return (
    <div className="products-page">

      {/* ── HEADER ── */}
      <div className="products-header">
        <div className="products-header-inner">
          <div className="products-header-left">
            <div className="prod-overline">
              <FontAwesomeIcon icon={faStore} /> Our Products
            </div>
            <h2 className="products-heading">Product Catalogue</h2>
          </div>
          <div className="products-header-right">
            <p>
              Explore our curated range of architectural and design products — each one
              selected for beauty, durability, and real-world performance.
            </p>
            <div className="prod-count-badge">
              <FontAwesomeIcon icon={faLayerGroup} />
              {products.length} product{products.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP CATEGORY BAR ── */}
      <nav className="prod-category-bar" aria-label="Product categories">
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            className={`prod-cat-pill${activeCategory === cat ? ' active' : ''}`}
            onClick={() => handleCategoryChange(cat)}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* ── MOBILE CATEGORY CHIPS ── */}
      <div className="prod-cat-mobile">
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            className={`prod-cat-chip${activeCategory === cat ? ' active' : ''}`}
            onClick={() => handleCategoryChange(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* ── SUBCATEGORY BAR ── */}
      {subcats.length > 0 && (
        <div className="prod-subcat-bar">
          <button
            className={`prod-subcat-chip${activeSubcategory === 'All' ? ' active' : ''}`}
            onClick={() => setActiveSubcategory('All')}
          >
            All
          </button>
          {subcats.map(sub => (
            <button
              key={sub}
              className={`prod-subcat-chip${activeSubcategory === sub ? ' active' : ''}`}
              onClick={() => setActiveSubcategory(sub)}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* ── PRODUCT GRID ── */}
      <div className="prod-body">
        <div className="products-grid">
          {loading ? (
            <div className="prod-empty">
              <div className="prod-empty-icon"><FontAwesomeIcon icon={faStore} /></div>
              <h3>Loading products…</h3>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map(product => (
              <ProductCard key={product._id} product={product} setShowLogin={setShowLogin} />
            ))
          ) : (
            <div className="prod-empty">
              <div className="prod-empty-icon"><FontAwesomeIcon icon={faStore} /></div>
              <h3>No products here yet</h3>
              <p>We're adding products to this section. Check back shortly.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="prod-cta">
        <div className="prod-cta-inner">
          <div className="prod-cta-overline">
            <FontAwesomeIcon icon={faCrown} /> Work With Us
          </div>
          <h2>Need Help Choosing?</h2>
          <p>
            Our design team will guide you through material selection, help you source
            the right products, and integrate them seamlessly into your project.
          </p>
          <button className="prod-cta-btn" onClick={() => setShowLogin(true)}>
            Book Free Consultation <FontAwesomeIcon icon={faCalendarCheck} />
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Products;
