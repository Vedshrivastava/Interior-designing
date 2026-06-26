'use client';
import '@/styles/design.css';
import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Image from 'next/image';
import { useModal } from '@/context/ModalContext';

// Cloudinary transform: serve compressed thumbnails for card/modal thumbnails
function cloudinaryThumb(url, width = 800) {
  if (!url) return null;
  if (!url.includes('res.cloudinary.com')) return url;
  return url.replace('/upload/', `/upload/w_${width},c_fill,f_auto,q_auto:good/`);
}

export default function Design({ id, name, description, images, points, category }) {
  const { openQuote } = useModal();
  const [modalOpen,     setModalOpen]     = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [activeThumb,   setActiveThumb]   = useState(0);

  const openModal  = () => { setModalOpen(true); document.body.style.overflow = 'hidden'; };
  const closeModal = useCallback(() => {
    setModalOpen(false); setLightboxIndex(null); setActiveThumb(0);
    document.body.style.overflow = '';
  }, []);

  const openLightbox  = (index) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goPrev = useCallback((e) => {
    e.stopPropagation();
    setLightboxIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback((e) => {
    e.stopPropagation();
    setLightboxIndex(prev => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (lightboxIndex === null && !modalOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        if (lightboxIndex !== null) closeLightbox();
        else closeModal();
      }
      if (lightboxIndex !== null) {
        if (e.key === 'ArrowLeft')  setLightboxIndex(prev => (prev - 1 + images.length) % images.length);
        if (e.key === 'ArrowRight') setLightboxIndex(prev => (prev + 1) % images.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, modalOpen, images.length, closeModal]);

  const handleGetQuote = () => {
    openQuote({ name, img: images[0], images, category });
    closeModal();
  };

  const card = (
    <div className="dc-card">
      <div className="dc-card-img-wrap" onClick={() => images?.length > 0 && openLightbox(0)}>
        <div className="dc-card-img-container">
          {images?.[0] ? (
            <Image
              src={images[0]}
              alt={`${name} — ${category || 'interior'} design by Shrivastavas Elevate, Satna MP`}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="dc-card-img"
              loading="lazy"
            />
          ) : (
            <div className="dc-card-img-placeholder" />
          )}
        </div>
        {images.length > 1 && <div className="dc-img-count">+{images.length - 1}</div>}
        <div className="dc-card-img-overlay"><span className="dc-view-label">View Images</span></div>
      </div>

      <div className="dc-card-body">
        <span className="dc-category-tag">
          {category?.replace(' Designs', '').replace(' Design', '') || 'Design'}
        </span>
        <h3 className="dc-card-title">{name}</h3>
        <p className="dc-card-desc">{description}</p>

        <div className="dc-card-footer">
          <button className="dc-card-quote-btn" onClick={e => { e.stopPropagation(); handleGetQuote(); }}>
            Get Quote
          </button>
          <button className="dc-see-details-btn" onClick={e => { e.stopPropagation(); openModal(); }}>
            See Details →
          </button>
        </div>
      </div>
    </div>
  );

  const modal = modalOpen && ReactDOM.createPortal(
    <div className="dc-modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true" aria-label={name}>
      <div className="dc-modal" onClick={e => e.stopPropagation()}>

        <div className="dc-modal-gallery">
          <div className="dc-modal-main-img-wrap" onClick={() => images?.[activeThumb] && openLightbox(activeThumb)}>
            <div className="dc-modal-main-img-container">
              {images?.[activeThumb] ? (
                <Image
                  src={images[activeThumb]}
                  alt={`${name} — ${category || 'interior'} design, image ${activeThumb + 1} | Shrivastavas Elevate, Satna MP`}
                  fill
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="dc-modal-main-img"
                />
              ) : (
                <div className="dc-card-img-placeholder" />
              )}
            </div>
            <div className="dc-modal-img-overlay">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
              </svg>
            </div>
          </div>
          {images.length > 1 && (
            <div className="dc-modal-thumbs">
              {images.map((src, i) => (
                <button key={i} className={`dc-thumb${i === activeThumb ? ' active' : ''}`}
                  onClick={() => setActiveThumb(i)} aria-label={`Image ${i + 1}`}>
                  <div className="dc-thumb-img-container">
                    <Image
                      src={cloudinaryThumb(src, 200)}
                      alt={`${name} — ${category || 'interior'} design thumbnail ${i + 1}`}
                      fill
                      sizes="80px"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dc-modal-content">
          <button className="dc-modal-close" onClick={closeModal} aria-label="Close">✕</button>
          <div className="dc-modal-tags"><span className="dc-modal-tag">{category}</span></div>
          <h2 className="dc-modal-title">{name}</h2>
          {description && (
            <div className="dc-modal-section">
              <h4 className="dc-modal-section-label">About this design</h4>
              <p className="dc-modal-desc">{description}</p>
            </div>
          )}
          {points && points.length > 0 && (
            <div className="dc-modal-section">
              <h4 className="dc-modal-section-label">Key features</h4>
              <ul className="dc-modal-points">
                {points.map((point, i) => (
                  <li key={i} className="dc-modal-point">
                    <span className="dc-point-dot" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="dc-modal-cta">
            <div className="dc-modal-actions">
              <button className="dc-quote-btn" onClick={handleGetQuote}>Get Free Quote</button>
              <button className="dc-close-btn" onClick={closeModal}>Close</button>
            </div>
            <p className="dc-cta-note">Our design consultants will reach out within 24 hours.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Lightbox uses full-res — plain <img> intentional (no fixed container dimensions)
  const lightbox = lightboxIndex !== null && ReactDOM.createPortal(
    <div className="lb-overlay" onClick={closeLightbox}>
      <button className="lb-close" onClick={closeLightbox} aria-label="Close">✕</button>
      {images.length > 1 && <button className="lb-arrow lb-arrow--prev" onClick={goPrev} aria-label="Previous">&#8249;</button>}
      <div className="lb-img-wrap" onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[lightboxIndex]} alt={`${name} — ${category || 'interior'} design, image ${lightboxIndex + 1} | Shrivastavas Elevate`} className="lb-img" />
        <div className="lb-caption">
          <span className="lb-name">{name}</span>
          {images.length > 1 && <span className="lb-counter">{lightboxIndex + 1} / {images.length}</span>}
        </div>
      </div>
      {images.length > 1 && <button className="lb-arrow lb-arrow--next" onClick={goNext} aria-label="Next">&#8250;</button>}
    </div>,
    document.body
  );

  return <>{card}{modal}{lightbox}</>;
}
