'use client';
import '@/styles/projects.css';
import { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';


import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { IconBuilding, IconHouseChimney, IconLayerGroup, IconCalendar, IconCrown, IconLocation, IconRulerCombined, IconClock, IconCalendarDays, IconQuoteLeft, IconStar, IconStarFilled, IconKey, IconArrowRight } from '@/components/Icons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/* ─── CountUp ─────────────────────────────────────────────────── */
const CountUp = ({ endValue, duration = 2300 }) => {
  const [count, setCount]       = useState(0);
  const [isVisible, setVisible] = useState(false);
  const ref = useRef(null);
  const match        = String(endValue).match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/);
  const prefix       = match ? match[1] : '';
  const targetNumber = match ? parseFloat(match[2]) : null;
  const suffix       = match ? match[3] : '';
  useEffect(() => {
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); o.disconnect(); } }, { threshold: 0.1 });
    if (ref.current) o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (!isVisible || targetNumber === null) return;
    let ts = null;
    const step = (t) => { if (!ts) ts = t; const p = Math.min((t - ts) / duration, 1); const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); setCount(e * targetNumber); if (p < 1) window.requestAnimationFrame(step); else setCount(targetNumber); };
    window.requestAnimationFrame(step);
  }, [isVisible, targetNumber, duration]);
  if (targetNumber === null) return <span ref={ref}>{endValue}</span>;
  return <span ref={ref}>{prefix}<span className="hp-prof-num">{Number.isInteger(targetNumber) ? Math.round(count) : count.toFixed(1)}</span>{suffix}</span>;
};

/* ─── ProjectCard ─────────────────────────────────────────────── */
const ProjectCard = ({ project, openConsult }) => {
  const [modalOpen,   setModalOpen]   = useState(false);
  const [activeThumb, setActiveThumb] = useState(0);
  const [lbIdx,       setLbIdx]       = useState(null);

  const {
    name, description, images = [], category, points = [],
    location, projectType, area, duration, completedAt, clientTestimonial, isFeatured,
  } = project;

  const formattedDate = completedAt
    ? new Date(completedAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : null;

  const openModal  = () => { setModalOpen(true); document.body.style.overflow = 'hidden'; };
  const closeModal = useCallback(() => { setModalOpen(false); setActiveThumb(0); setLbIdx(null); document.body.style.overflow = ''; }, []);
  const openLb  = (i) => setLbIdx(i);
  const closeLb = useCallback(() => setLbIdx(null), []);
  const lbPrev  = useCallback((e) => { e.stopPropagation(); setLbIdx(i => (i - 1 + images.length) % images.length); }, [images.length]);
  const lbNext  = useCallback((e) => { e.stopPropagation(); setLbIdx(i => (i + 1) % images.length); }, [images.length]);

  useEffect(() => {
    if (lbIdx === null && !modalOpen) return;
    const h = (e) => {
      if (e.key === 'Escape') { lbIdx !== null ? closeLb() : closeModal(); }
      if (lbIdx !== null) {
        if (e.key === 'ArrowLeft')  setLbIdx(i => (i - 1 + images.length) % images.length);
        if (e.key === 'ArrowRight') setLbIdx(i => (i + 1) % images.length);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lbIdx, modalOpen, images.length, closeModal, closeLb]);

  const card = (
    <div className="proj-card">
      <div className="proj-card-img-wrap" onClick={() => images?.length > 0 && openLb(0)}>
        {images?.[0]
          ? /* eslint-disable-next-line @next/next/no-img-element */
            <img src={images[0]} alt={name} loading="lazy" />
          : <div className="proj-card-img-placeholder" />
        }
        {images.length > 1 && <div className="proj-card-img-count">+{images.length - 1}</div>}
        <div className="proj-card-img-overlay"><span>View Images</span></div>
        {projectType && (
          <div className="proj-card-type-badge">
            {projectType === 'Residential' ? <IconHouseChimney /> : <IconBuilding />}
            {projectType}
          </div>
        )}
        {isFeatured && (
          <div className="proj-card-featured-ribbon">
            <IconStarFilled /> Featured
          </div>
        )}
      </div>
      <div className="proj-card-body">
        <h3 className="proj-card-title">{name}</h3>
        {location && (
          <div className="proj-card-location">
            <IconLocation /> {location}
          </div>
        )}
        {(area || duration || formattedDate) && (
          <div className="proj-card-chips">
            {area          && <span className="proj-chip"><IconRulerCombined />{area}</span>}
            {duration      && <span className="proj-chip"><IconClock />{duration}</span>}
            {formattedDate && <span className="proj-chip"><IconCalendarDays />{formattedDate}</span>}
          </div>
        )}
        <button className="proj-card-btn" onClick={openModal}>
          See Details <IconArrowRight />
        </button>
      </div>
    </div>
  );

  const modal = modalOpen && ReactDOM.createPortal(
    <div className="proj-modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true" aria-label={name}>
      <div className="proj-modal" onClick={e => e.stopPropagation()}>
        <div className="proj-modal-gallery">
          <div className="proj-modal-main-img-wrap" onClick={() => openLb(activeThumb)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
                <button key={i} className={`proj-modal-thumb${i === activeThumb ? ' active' : ''}`}
                  onClick={() => setActiveThumb(i)} aria-label={`Image ${i + 1}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Thumbnail ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="proj-modal-content">
          <button className="proj-modal-close" onClick={closeModal} aria-label="Close">✕</button>
          <div className="proj-modal-tags">
            {projectType && (
              <span className="proj-modal-tag proj-modal-tag--type">
                {projectType === 'Residential' ? <IconHouseChimney /> : <IconBuilding />} {projectType}
              </span>
            )}
            <span className="proj-modal-tag">{category}</span>
          </div>
          <h2 className="proj-modal-title">{name}</h2>
          {location && (
            <div className="proj-modal-location">
              <IconLocation /> {location}
            </div>
          )}
          {(area || duration || formattedDate) && (
            <div className="proj-modal-chips">
              {area         && <span className="proj-chip"><IconRulerCombined />{area}</span>}
              {duration     && <span className="proj-chip"><IconClock />{duration}</span>}
              {formattedDate && <span className="proj-chip"><IconCalendarDays />{formattedDate}</span>}
            </div>
          )}
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
                    <span className="proj-point-dot" aria-hidden="true" /> {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {clientTestimonial && (
            <div className="proj-modal-testimonial">
              <IconQuoteLeft className="proj-testimonial-icon" />
              <p>&ldquo;{clientTestimonial}&rdquo;</p>
              <div className="proj-testimonial-stars">
                {[1,2,3,4,5].map(s => <IconStarFilled key={s} />)}
              </div>
            </div>
          )}
          <div className="proj-modal-cta">
            <button className="proj-modal-cta-btn" onClick={() => { closeModal(); openConsult(); }}>
              Get Free Consultation <IconCalendar />
            </button>
            <button className="proj-modal-close-btn" onClick={closeModal}>Close</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  const lightbox = lbIdx !== null && ReactDOM.createPortal(
    <div className="proj-lb-overlay" onClick={closeLb}>
      <button className="proj-lb-close" onClick={closeLb} aria-label="Close">✕</button>
      {images.length > 1 && <button className="proj-lb-arrow proj-lb-arrow--prev" onClick={lbPrev} aria-label="Previous">&#8249;</button>}
      <div className="proj-lb-img-wrap" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[lbIdx]} alt={`${name} — ${lbIdx + 1}`} className="proj-lb-img" />
        <div className="proj-lb-caption">
          <span>{name}</span>
          {images.length > 1 && <span>{lbIdx + 1} / {images.length}</span>}
        </div>
      </div>
      {images.length > 1 && <button className="proj-lb-arrow proj-lb-arrow--next" onClick={lbNext} aria-label="Next">&#8250;</button>}
    </div>,
    document.body
  );

  return <>{card}{modal}{lightbox}</>;
};

/* ─── Projects page ───────────────────────────────────────────── */
export default function ProjectsPage() {
  const { openConsult } = useModal();
  const [projects,     setProjects]     = useState([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/project/list`);
      if (res.data.success) setProjects(res.data.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

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
              <IconBuilding /> Portfolio
            </div>
            <h2 className="project-heading">Recent Projects</h2>
          </div>
          <div className="project-header-right">
            <p className="project-main-para">
              A showcase of our finest work — each project a testament to
              precision craftsmanship, premium materials and timeless design.
            </p>
            <div className="proj-count-badge">
              <IconLayerGroup />
              {projects.length} project{projects.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="proj-stats">
        {[
          { val: '50+',  label: 'Projects Completed'  },
          { val: '5+',   label: 'Years Experience'    },
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
              {f === 'Residential' && <IconHouseChimney />}
              {f === 'Commercial'  && <IconBuilding />}
              {f} {f !== 'All' && `(${projects.filter(p => p.projectType === f).length})`}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="project-display-list">
          {loading ? (
            <div className="proj-empty">
              <div className="proj-empty-icon"><IconBuilding /></div>
              <h3>Loading projects…</h3>
            </div>
          ) : error ? (
            <div className="proj-empty">
              <div className="proj-empty-icon"><IconBuilding /></div>
              <h3>Couldn&apos;t load projects</h3>
              <p>Please check your connection and try refreshing the page.</p>
            </div>
          ) : filtered.length > 0 ? (
            filtered.map(project => (
              <ProjectCard key={project._id} project={project} openConsult={openConsult} />
            ))
          ) : (
            <div className="proj-empty">
              <div className="proj-empty-icon"><IconBuilding /></div>
              <h3>No {activeFilter !== 'All' ? activeFilter.toLowerCase() + ' ' : ''}projects yet</h3>
              <p>We&apos;re uploading our latest work. Check back shortly.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CTA ── */}
      <div className="proj-cta">
        <div className="proj-cta-inner">
          <div className="proj-cta-overline">
            <IconCrown /> Begin Your Journey
          </div>
          <h2>Love What You See?</h2>
          <p>
            Let&apos;s bring the same level of craft and care to your home.
            Book a free consultation and we&apos;ll take it from there.
          </p>
          <button className="proj-cta-btn" onClick={openConsult}>
            Book Free Consultation <IconCalendar />
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
