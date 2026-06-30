'use client';
import '@/styles/designDisplay.css';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';


import Design from '@/components/Design';
import Footer from '@/components/Footer';
import { useWebSocket } from '@/hooks/useWebSocket';
import { IconLayerGroup, IconStar, IconStarFilled, IconChevronLeft, IconChevronRight } from '@/components/Icons';
import { CATEGORY_SLUGS, SLUG_LABELS, SLUG_TO_CATEGORY } from '@/lib/categories';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function DesignDisplayPage({
  slug,
  initialDesigns = [],
  initialTotal   = 0,
  pageLimit      = 20,
  categories     = null,
}) {
  const router   = useRouter();
  const mobileBarRef = useRef(null);

  const FALLBACK_CATS = CATEGORY_SLUGS.map(s => ({ slug: s, label: SLUG_LABELS[s], name: SLUG_TO_CATEGORY[s] }));
  const [catList, setCatList] = useState(categories ?? FALLBACK_CATS);
  const category = catList.find(c => c.slug === slug)?.name || SLUG_TO_CATEGORY[slug] || slug;

  const fetchCategories = useCallback(() => {
    fetch(`${API_URL}/api/category/list`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.length > 0) setCatList(d.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const [designList,  setDesignList]  = useState(initialDesigns);
  const [total,       setTotal]       = useState(initialTotal);
  const [page,        setPage]        = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cardsPerView, setCardsPerView] = useState(3);
  const [sliderIndex,  setSliderIndex]  = useState(0);

  const hasMore = designList.length < total;

  useEffect(() => {
    const handleResize = () => setCardsPerView(window.innerWidth < 900 ? 2 : 3);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset slider when category changes OR viewport resizes across breakpoint
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSliderIndex(0); }, [category, cardsPerView]);

  const fetchPage = useCallback(async (pageNum, replace = false) => {
    try {
      const res = await axios.get(
        `${API_URL}/api/design/list?category=${encodeURIComponent(category)}&page=${pageNum}&limit=${pageLimit}`
      );
      const { data, total: newTotal } = res.data;
      setTotal(newTotal ?? data.length);
      setDesignList(prev => replace ? data : [...prev, ...data]);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching designs:', err);
    }
  }, [category, pageLimit]);

  // Fetch fresh data on mount and whenever category changes (fetchPage is stable per category)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setPage(1);
    fetchPage(1, true);
  }, [fetchPage]);

  // WebSocket: instantly re-fetch when admin adds/edits/removes a design
  useWebSocket(useCallback((msg) => {
    if (msg.type === 'designsChanged')    fetchPage(1, true);
    if (msg.type === 'categoriesChanged') fetchCategories();
  }, [fetchPage, fetchCategories]));

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchPage(page + 1, false);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (!mobileBarRef.current) return;
    const active = mobileBarRef.current.querySelector('.dd-cat-chip.active');
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'instant' });
  }, [category]);

  const displayName = SLUG_LABELS[slug] || category;
  const featuredDesigns = designList.filter(item => item.isFeatured);
  const regularDesigns  = designList.filter(item => !item.isFeatured);

  const canSlidePrev    = sliderIndex > 0;
  const canSlideNext    = sliderIndex < featuredDesigns.length - cardsPerView;
  const hasMoreThanView = featuredDesigns.length > cardsPerView;

  const slidePrev = useCallback(() => setSliderIndex(i => Math.max(0, i - 1)), []);
  const slideNext = useCallback(
    (total) => setSliderIndex(i => Math.min(total - cardsPerView, i + 1)),
    [cardsPerView]
  );

  return (
    <div>
      <div className="design-display-main" id="design-display">

        <div className="dd-header">
          <div className="dd-header-inner">
            <div className="dd-header-left">
              <div className="dd-overline"><IconLayerGroup /> Our Designs</div>
              <h1>{displayName}</h1>
            </div>
            <div className="dd-header-right">
              <p>Explore our curated collection of {displayName.toLowerCase()}, each crafted with premium materials, precision and timeless elegance.</p>
              <div className="dd-count-badge">
                <IconLayerGroup />
                {total} design{total !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>

        <nav className="dd-category-bar" aria-label="Design categories">
          {catList.map(cat => (
            <button
              key={cat.slug}
              className={`dd-cat-pill${slug === cat.slug ? ' active' : ''}`}
              onClick={() => router.push(`/design/${cat.slug}`)}
            >
              {cat.name}
            </button>
          ))}
        </nav>

        <div className="dd-cat-mobile" ref={mobileBarRef}>
          {catList.map(cat => (
            <button
              key={cat.slug}
              className={`dd-cat-chip${slug === cat.slug ? ' active' : ''}`}
              onClick={() => router.push(`/design/${cat.slug}`)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {featuredDesigns.length > 0 && (
          <section className="dd-featured-section">
            <div className="dd-featured-header">
              <div className="dd-featured-header-left">
                <span className="dd-featured-overline"><IconStarFilled /> Featured Picks</span>
                <h2 className="dd-featured-heading">Handpicked for You</h2>
              </div>
              <div className="dd-featured-header-right">
                <p className="dd-featured-subtext">Our team&apos;s top selections: standout designs with exceptional detailing and finish.</p>
                {hasMoreThanView && (
                  <div className="dd-slider-controls">
                    <button className={`dd-slider-arrow${!canSlidePrev ? ' disabled' : ''}`} onClick={slidePrev} disabled={!canSlidePrev} aria-label="Previous">
                      <IconChevronLeft />
                    </button>
                    <span className="dd-slider-counter">
                      {sliderIndex + 1}–{Math.min(sliderIndex + cardsPerView, featuredDesigns.length)}
                      <span className="dd-slider-counter-total"> of {featuredDesigns.length}</span>
                    </span>
                    <button className={`dd-slider-arrow${!canSlideNext ? ' disabled' : ''}`} onClick={() => slideNext(featuredDesigns.length)} disabled={!canSlideNext} aria-label="Next">
                      <IconChevronRight />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="dd-slider-viewport">
              <div className="dd-slider-track" style={{ '--slide-index': sliderIndex }}>
                {featuredDesigns.map(item => {
                  const catObj = catList.find(c => c.name === item.category);
                  return (
                    <div key={item._id} className="dd-featured-card-wrap">
                      <div className="dd-featured-ribbon"><IconStarFilled /> Featured</div>
                      <Design
                        id={item._id} name={item.name} description={item.description}
                        images={item.images} points={item.points} category={item.category}
                        categoryLabel={catObj?.label || undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {hasMoreThanView && (
              <div className="dd-slider-dots">
                {Array.from({ length: featuredDesigns.length - cardsPerView + 1 }).map((_, i) => (
                  <button key={i} className={`dd-slider-dot${sliderIndex === i ? ' active' : ''}`} onClick={() => setSliderIndex(i)} aria-label={`Go to slide ${i + 1}`} />
                ))}
              </div>
            )}
          </section>
        )}

        <div className="dd-body">
          {regularDesigns.length > 0 && featuredDesigns.length > 0 && (
            <div className="dd-section-label">All Designs</div>
          )}
          <div className="design-display-list">
            {designList.length > 0 ? (
              regularDesigns.map(item => {
                const catObj = catList.find(c => c.name === item.category);
                return (
                  <Design
                    key={item._id} id={item._id} name={item.name}
                    description={item.description} images={item.images}
                    points={item.points} category={item.category}
                    categoryLabel={catObj?.label || undefined}
                  />
                );
              })
            ) : (
              <div className="dd-empty">
                <div className="dd-empty-icon"><IconLayerGroup /></div>
                <h3>No designs yet</h3>
                <p>We&apos;re adding new {displayName.toLowerCase()} soon. Check back shortly.</p>
              </div>
            )}
          </div>

          {hasMore && (
            <div className="dd-load-more-wrap">
              <button
                className="dd-load-more-btn"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : `Load More (${total - designList.length} remaining)`}
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
