import React, { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import '../styles/projects.css';
import { useWebSocket } from '../hooks/useWebSocket';
import Footer from '../components/Footer';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding, faHome, faLayerGroup, faCalendarCheck, faCrown,
  faLocationDot, faRulerCombined, faClock, faCalendarDays, faQuoteLeft,
  faChevronLeft, faChevronRight, faStar,
} from '@fortawesome/free-solid-svg-icons';

/* ─── CountUp ─────────────────────────────────────────────────── */
const CountUp = ({ endValue, duration = 2300 }) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  const match = String(endValue).match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/);
  const prefix       = match ? match[1] : '';
  const targetNumber = match ? parseFloat(match[2]) : null;
  const suffix       = match ? match[3] : '';

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible || targetNumber === null) return;
    let startTimestamp = null;
    const step = (ts) => {
      if (!startTimestamp) startTimestamp = ts;
      const progress     = Math.min((ts - startTimestamp) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(easeProgress * targetNumber);
      if (progress < 1) window.requestAnimationFrame(step);
      else setCount(targetNumber);
    };
    window.requestAnimationFrame(step);
  }, [isVisible, targetNumber, duration]);

  if (targetNumber === null) return <span ref={ref}>{endValue}</span>;
  const displayCount = Number.isInteger(targetNumber) ? Math.round(count) : count.toFixed(1);
  return <span ref={ref}>{prefix}<span className="hp-prof-num">{displayCount}</span>{suffix}</span>;
};

/* ─── ProjectCard ─────────────────────────────────────────────── */
const ProjectCard = ({ project }) => {
  const [modalOpen,    setModalOpen]    = useState(false);
  const [activeThumb,  setActiveThumb]  = useState(0);
  const [lightboxIdx,  setLightboxIdx]  = useState(null);

  const {
    name, description, images = [], category, points = [],
    location, projectType, area, duration, completedAt, clientTestimonial,
    isFeatured,
  } = project;

  const formattedDate = completedAt
    ? new Date(completedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;

  const openModal  = () => { setModalOpen(true);  document.body.style.overflow = 'hidden'; };
  const closeModal = useCallback(() => {
    setModalOpen(false); setActiveThumb(0); setLightboxIdx(null);
    document.body.style.overflow = '';
  }, []);

  const openLightbox  = (i) => setLightboxIdx(i);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);
  const lbPrev = useCallback((e) => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + images.length) % images.length); }, [images.length]);
  const lbNext = useCallback((e) => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % images.length); }, [images.length]);

  useEffect(() => {
    if (lightboxIdx === null && !modalOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape')      { lightboxIdx !== null ? closeLightbox() : closeModal(); }
      if (lightboxIdx !== null) {
        if (e.key === 'ArrowLeft')  setLightboxIdx(i => (i - 1 + images.length) % images.length);
        if (e.key === 'ArrowRight') setLightboxIdx(i => (i + 1) % images.length);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIdx, modalOpen, images.length, closeModal, closeLightbox]);

  /* ── Card ── */
  const card = (
    <div className="proj-card">
      <div className="proj-card-img-wrap" onClick={() => openLightbox(0)}>
        <img src={images[0]} alt={name} loading="lazy" />
        {images.length > 1 && <div className="proj-card-img-count">+{images.length - 1}</div>}
        <div className="proj-card-img-overlay"><span>View Images</span></div>
        <div className="proj-card-type-badge">
          <FontAwesomeIcon icon={projectType === 'Residential' ? faHome : faBuilding} />
          {projectType}
        </div>
        {isFeatured && (
          <div className="proj-card-featured-ribbon">
            <FontAwesomeIcon icon={faStar} /> Featured
          </div>
        )}
      </div>

      <div className="proj-card-body">
        <span className="proj-card-category">{category}</span>

        <h3 className="proj-card-title">{name}</h3>

        <div className="proj-card-location">
          <FontAwesomeIcon icon={faLocationDot} />
          {location}
        </div>

        <div className="proj-card-chips">
          {area     && <span className="proj-chip"><FontAwesomeIcon icon={faRulerCombined} />{area}</span>}
          {duration && <span className="proj-chip"><FontAwesomeIcon icon={faClock} />{duration}</span>}
          {formattedDate && <span className="proj-chip"><FontAwesomeIcon icon={faCalendarDays} />{formattedDate}</span>}
        </div>

        <button className="proj-card-btn" onClick={openModal}>See Details →</button>
      </div>
    </div>
  );

  /* ── Modal ── */
  const modal = modalOpen && ReactDOM.createPortal(
    <div className="proj-modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true" aria-label={name}>
      <div className="proj-modal" onClick={(e) => e.stopPropagation()}>

        {/* Left — gallery */}
        <div className="proj-modal-gallery">
          <div className="proj-modal-main-img-wrap" onClick={() => openLightbox(activeThumb)}>
            <img src={images[activeThumb]} alt={`${name} — view ${activeThumb + 1}`} className="proj-modal-main-img" />
            <div className="proj-modal-img-hint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </div>
          </div>
          {images.length > 1 && (
            <div className="proj-modal-thumbs">
              {images.map((src, i) => (
                <button
                  key={i}
                  className={`proj-modal-thumb${i === activeThumb ? ' active' : ''}`}
                  onClick={() => setActiveThumb(i)}
                  aria-label={`Image ${i + 1}`}
                >
                  <img src={src} alt={`Thumbnail ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right — content */}
        <div className="proj-modal-content">
          <button className="proj-modal-close" onClick={closeModal} aria-label="Close">✕</button>

          <div className="proj-modal-tags">
            <span className="proj-modal-tag proj-modal-tag--type">
              <FontAwesomeIcon icon={projectType === 'Residential' ? faHome : faBuilding} />
              {projectType}
            </span>
            <span className="proj-modal-tag">{category}</span>
          </div>

          <h2 className="proj-modal-title">{name}</h2>

          <div className="proj-modal-location">
            <FontAwesomeIcon icon={faLocationDot} />
            {location}
          </div>

          <div className="proj-modal-chips">
            {area        && <span className="proj-chip"><FontAwesomeIcon icon={faRulerCombined} />{area}</span>}
            {duration    && <span className="proj-chip"><FontAwesomeIcon icon={faClock} />{duration}</span>}
            {formattedDate && <span className="proj-chip"><FontAwesomeIcon icon={faCalendarDays} />{formattedDate}</span>}
          </div>

          {description && (
            <div className="proj-modal-section">
              <h4 className="proj-modal-section-label">About this project</h4>
              <p className="proj-modal-desc">{description}</p>
            </div>
          )}

          {points.length > 0 && (
            <div className="proj-modal-section">
              <h4 className="proj-modal-section-label">Key highlights</h4>
              <ul className="proj-modal-points">
                {points.map((pt, i) => (
                  <li key={i} className="proj-modal-point">
                    <span className="proj-point-dot" aria-hidden="true" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {clientTestimonial && (
            <div className="proj-modal-testimonial">
              <FontAwesomeIcon icon={faQuoteLeft} className="proj-testimonial-icon" />
              <p>"{clientTestimonial}"</p>
              <div className="proj-testimonial-stars">
                {[1,2,3,4,5].map(s => <FontAwesomeIcon key={s} icon={faStar} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  /* ── Lightbox ── */
  const lightbox = lightboxIdx !== null && ReactDOM.createPortal(
    <div className="proj-lb-overlay" onClick={closeLightbox}>
      <button className="proj-lb-close" onClick={closeLightbox} aria-label="Close">✕</button>
      {images.length > 1 && (
        <button className="proj-lb-arrow proj-lb-arrow--prev" onClick={lbPrev} aria-label="Previous">&#8249;</button>
      )}
      <div className="proj-lb-img-wrap" onClick={(e) => e.stopPropagation()}>
        <img src={images[lightboxIdx]} alt={`${name} — ${lightboxIdx + 1}`} className="proj-lb-img" />
        <div className="proj-lb-caption">
          <span>{name}</span>
          {images.length > 1 && <span>{lightboxIdx + 1} / {images.length}</span>}
        </div>
      </div>
      {images.length > 1 && (
        <button className="proj-lb-arrow proj-lb-arrow--next" onClick={lbNext} aria-label="Next">&#8250;</button>
      )}
    </div>,
    document.body
  );

  return (
    <>
      {card}
      {modal}
      {lightbox}
    </>
  );
};

/* ─── Projects page ───────────────────────────────────────────── */
const Projects = ({ setShowLogin }) => {
  const url = "http://localhost:3000";
  const [projects,       setProjects]       = useState([]);
  const [activeFilter,   setActiveFilter]   = useState('All');
  const [loading,        setLoading]        = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await axios.get(`${url}/api/project/list`);
      if (response.data.success) setProjects(response.data.data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // Refetch silently when admin changes projects
  useWebSocket(useCallback((msg) => {
    if (msg.type === 'projectsChanged') fetchProjects();
  }, [fetchProjects]));

  const filtered = (activeFilter === 'All'
    ? projects
    : projects.filter(p => p.projectType === activeFilter)
  ).sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));

  return (
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
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="proj-stats">
        {[
          { val: '50+', label: 'Projects Completed' },
          { val: '5+',  label: 'Years Experience'   },
          { val: '100%', label: 'Client Satisfaction' },
        ].map((s, i) => (
          <div className="proj-stat-item" key={i}>
            <h3><CountUp endValue={s.val} /></h3>
            <p>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── BODY ── */}
      <div className="proj-body">

        {/* Filter tabs */}
        <div className="proj-filter-bar">
          {['All', 'Residential', 'Commercial'].map(f => (
            <button
              key={f}
              className={`proj-filter-btn${activeFilter === f ? ' active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f === 'Residential' && <FontAwesomeIcon icon={faHome} />}
              {f === 'Commercial'  && <FontAwesomeIcon icon={faBuilding} />}
              {f} {f !== 'All' && `(${projects.filter(p => p.projectType === f).length})`}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="project-display-list">
          {loading ? (
            <div className="proj-empty">
              <div className="proj-empty-icon"><FontAwesomeIcon icon={faBuilding} /></div>
              <h3>Loading projects…</h3>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map(project => (
              <ProjectCard key={project._id} project={project} />
            ))
          ) : (
            <div className="proj-empty">
              <div className="proj-empty-icon"><FontAwesomeIcon icon={faBuilding} /></div>
              <h3>No {activeFilter !== 'All' ? activeFilter.toLowerCase() + ' ' : ''}projects yet</h3>
              <p>We're uploading our latest work. Check back shortly.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="proj-cta">
        <div className="proj-cta-inner">
          <div className="proj-cta-overline">
            <FontAwesomeIcon icon={faCrown} /> Begin Your Journey
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

      <Footer />
    </div>
  );
};

export default Projects;
