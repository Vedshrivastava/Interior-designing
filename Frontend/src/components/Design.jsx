import React, { useState, useEffect, useCallback } from 'react';
import Slider from 'react-slick';
import '../styles/design.css';
import 'slick-carousel/slick/slick.css'; // Import slick-carousel CSS
import 'slick-carousel/slick/slick-theme.css'; // Import slick-carousel theme CSS
import Consult from './consult';

const Design = ({ id, name, description, images, points, setShowLogin, setConsultData, consultData }) => {
  const [showMore, setShowMore] = useState(false);
  const [buttonAtBottom, setButtonAtBottom] = useState(false);
  const [lightbox, setLightbox] = useState({ open: false, index: 0 });
  const hasMultipleImages = images.length > 1;

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: true,
  };

  const handleToggle = () => {
    setShowMore(!showMore);
    setButtonAtBottom(!buttonAtBottom);
  };

  const handleGetQuote = (name, img) => {
    setShowLogin(true);
    setConsultData({ name, img });
    console.log({ name, img });
  };

  const openLightbox = (index) => {
    setLightbox({ open: true, index });
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = useCallback(() => {
    setLightbox({ open: false, index: 0 });
    document.body.style.overflow = '';
  }, []);

  const goPrev = useCallback((e) => {
    e.stopPropagation();
    setLightbox(prev => ({ ...prev, index: (prev.index - 1 + images.length) % images.length }));
  }, [images.length]);

  const goNext = useCallback((e) => {
    e.stopPropagation();
    setLightbox(prev => ({ ...prev, index: (prev.index + 1) % images.length }));
  }, [images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightbox.open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft')  setLightbox(prev => ({ ...prev, index: (prev.index - 1 + images.length) % images.length }));
      if (e.key === 'ArrowRight') setLightbox(prev => ({ ...prev, index: (prev.index + 1) % images.length }));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightbox.open, images.length, closeLightbox]);

  useEffect(() => {
    console.log("Updated consultData:", consultData);
  }, [consultData]);

  return (
    <div className="design-display">
      {/* ── LIGHTBOX ── */}
      {lightbox.open && (
        <div className="lb-overlay" onClick={closeLightbox}>
          <button className="lb-close" onClick={closeLightbox} aria-label="Close">✕</button>

          {images.length > 1 && (
            <button className="lb-arrow lb-arrow--prev" onClick={goPrev} aria-label="Previous">&#8249;</button>
          )}

          <div className="lb-img-wrap" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[lightbox.index]}
              alt={`${name} — ${lightbox.index + 1}`}
              className="lb-img"
            />
            <div className="lb-caption">
              <span className="lb-name">{name}</span>
              {images.length > 1 && (
                <span className="lb-counter">{lightbox.index + 1} / {images.length}</span>
              )}
            </div>
          </div>

          {images.length > 1 && (
            <button className="lb-arrow lb-arrow--next" onClick={goNext} aria-label="Next">&#8250;</button>
          )}
        </div>
      )}

      <div className="design-slider">
        {hasMultipleImages ? (
          <Slider {...settings}>
            {images.map((imageUrl, index) => (
              <div key={index} className="design-slide" onClick={() => openLightbox(index)}>
                <img src={imageUrl} alt={`Design ${index}`} className="lb-trigger" />
              </div>
            ))}
          </Slider>
        ) : (
          <div className="design-slide" onClick={() => openLightbox(0)}>
            <img src={images[0]} alt={`Design 0`} className="lb-trigger" />
          </div>
        )}
      </div>
      <div className={`design-info ${buttonAtBottom ? 'button-at-bottom' : ''}`}>
        <h2>{name}</h2>
        <h3>Description</h3>
        <p className={`description-text ${showMore ? 'expanded' : 'collapsed'}`}>
          {description}
        </p>
        <button className="see-more-button" onClick={handleToggle}>
          {showMore ? 'See Less ▲' : 'See More ▼'}
        </button>
        {showMore && (
          <>
            <h3>Features</h3>
            <ul className="design-points expanded">
              {points && points.length > 0 && points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </>
        )}
        <button onClick={() => handleGetQuote(name, images[0])} className="get-quote-button">
          Get Quote
        </button>
      </div>
    </div>
  );
}

export default Design;
