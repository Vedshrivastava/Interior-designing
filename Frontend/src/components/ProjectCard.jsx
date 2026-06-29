'use client';
import '@/styles/projects.css';
import { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { cloudinaryOptimize } from '@/lib/cloudinary';
import {
  IconBuilding, IconHouseChimney, IconLocation, IconRulerCombined,
  IconClock, IconCalendarDays, IconQuoteLeft, IconStarFilled,
  IconArrowRight, IconCalendar,
} from '@/components/Icons';

export default function ProjectCard({ project, openConsult }) {
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
            <img src={cloudinaryOptimize(images[0], { width: 800 })} alt={`${name}${location ? ` in ${location}` : ''} — interior design project by Shrivastavas Elevate`} loading="lazy" />
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
            <img src={cloudinaryOptimize(images[activeThumb], { width: 1200 })} alt={`${name} — project image ${activeThumb + 1}`} className="proj-modal-main-img" />
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
                  <img src={cloudinaryOptimize(src, { width: 200 })} alt={`${name} — image ${i + 1}`} />
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
            {category && <span className="proj-modal-tag">{category}</span>}
          </div>
          <h2 className="proj-modal-title">{name}</h2>
          {location && (
            <div className="proj-modal-location">
              <IconLocation /> {location}
            </div>
          )}
          {(area || duration || formattedDate) && (
            <div className="proj-modal-chips">
              {area          && <span className="proj-chip"><IconRulerCombined />{area}</span>}
              {duration      && <span className="proj-chip"><IconClock />{duration}</span>}
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
        <img src={cloudinaryOptimize(images[lbIdx])} alt={`${name} — project image ${lbIdx + 1}`} className="proj-lb-img" />
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
}
