'use client';
import '@/styles/productsPage.css';
import { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import {
  IconStore, IconLayerGroup, IconCalendar, IconCrown, IconStar, IconInfo,
  IconCheck, IconSearch, IconShield, IconScrewdriverWrench, IconPenRuler,
  IconDroplet, IconSun, IconFire, IconCloud, IconLeaf, IconVolumeX,
  IconThermometer, IconPen,
} from '@/components/Icons';
import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cloudinaryOptimize } from '@/lib/cloudinary';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const SUBCATEGORIES = {
  'Interior':                 ['Ceilings', 'Wall Features', 'Flooring', 'Lighting', 'Furniture'],
  'Exterior':                 ['Facades', 'Cladding', 'Landscaping', 'Pergolas'],
  'Functional Architecture':  ['Breeze Blocks', 'Jaali Walls', 'Decorative Screens', 'Feature Walls', 'Privacy Screens'],
};
const CATEGORIES = Object.keys(SUBCATEGORIES);

const SPEC_META = {
  'Waterproof':          { Icon: IconDroplet,        color: '#3b82f6' },
  'UV Protection':       { Icon: IconSun,             color: '#f59e0b' },
  'Fire Resistant':      { Icon: IconFire,            color: '#ef4444' },
  'Weather Resistant':   { Icon: IconCloud,       color: '#6366f1' },
  'Eco-Friendly':        { Icon: IconLeaf,            color: '#22c55e' },
  'Low Maintenance':     { Icon: IconScrewdriverWrench,          color: '#8b5cf6' },
  'Anti-Fungal':         { Icon: IconShield,    color: '#14b8a6' },
  'Sound Insulation':    { Icon: IconVolumeX,     color: '#ec4899' },
  'Thermal Insulation':  { Icon: IconThermometer, color: '#f97316' },
  'Scratch Resistant':   { Icon: IconShield,          color: '#64748b' },
  'Fade Resistant':      { Icon: IconSun,             color: '#a78bfa' },
  'Customizable':        { Icon: IconPen,             color: '#c9a87c' },
  'Non-Toxic':           { Icon: IconLeaf,            color: '#10b981' },
  'Rust Resistant':      { Icon: IconShield,    color: '#78716c' },
};

const ProductCard = ({ product, openConsult }) => {
  const [modalOpen,   setModalOpen]   = useState(false);
  const [activeThumb, setActiveThumb] = useState(0);
  const [lbIdx,       setLbIdx]       = useState(null);

  const { name, description, images = [], categories, category, subcategory, material, finish, specialities = [], applications = [], points = [], isFeatured } = product;
  const categoryList = categories?.length ? categories : (category ? [category] : []);

  const openModal  = () => { setModalOpen(true); document.body.style.overflow = 'hidden'; };
  const closeModal = useCallback(() => { setModalOpen(false); setActiveThumb(0); setLbIdx(null); document.body.style.overflow = ''; }, []);
  const openLb = (i) => setLbIdx(i);
  const closeLb = useCallback(() => setLbIdx(null), []);
  const lbPrev = useCallback((e) => { e.stopPropagation(); setLbIdx(i => (i - 1 + images.length) % images.length); }, [images.length]);
  const lbNext = useCallback((e) => { e.stopPropagation(); setLbIdx(i => (i + 1) % images.length); }, [images.length]);

  useEffect(() => {
    if (lbIdx === null && !modalOpen) return;
    const h = (e) => {
      if (e.key === 'Escape') { lbIdx !== null ? closeLb() : closeModal(); }
      if (lbIdx !== null) { if (e.key === 'ArrowLeft') setLbIdx(i => (i - 1 + images.length) % images.length); if (e.key === 'ArrowRight') setLbIdx(i => (i + 1) % images.length); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lbIdx, modalOpen, images.length, closeModal, closeLb]);

  const card = (
    <div className="prod-card">
      <div className="prod-card-img-wrap" onClick={() => images?.length > 0 && openLb(0)}>
        {images?.[0]
          ? <img src={cloudinaryOptimize(images[0], { width: 800 })} alt={`${name} — ${categoryList.join(', ')} by Shrivastavas Elevate, Satna MP`} loading="lazy" />
          : <div className="prod-card-img-placeholder" />
        }
        {images.length > 1 && <div className="prod-card-img-count">+{images.length - 1}</div>}
        <div className="prod-card-img-overlay"><span>View Images</span></div>
        {isFeatured && <div className="prod-card-featured-ribbon"><IconStar /> Featured</div>}
      </div>
      <div className="prod-card-body">
        <div className="prod-card-tags">
          {categoryList.map(cat => <span key={cat} className="prod-card-cat-tag">{cat}</span>)}
          {subcategory && <span className="prod-card-subcat-tag">{subcategory}</span>}
        </div>
        <h3 className="prod-card-title">{name}</h3>
        <p className="prod-card-desc">{description}</p>
        {(material || finish) && (
          <div className="prod-card-chips">
            {material && <span className="prod-chip"><IconLayerGroup />{material}</span>}
            {finish   && <span className="prod-chip"><IconStar />{finish}</span>}
          </div>
        )}
        <button className="prod-card-btn" onClick={openModal}>See Details →</button>
      </div>
    </div>
  );

  const modal = modalOpen && ReactDOM.createPortal(
    <div className="prod-modal-backdrop" onClick={closeModal} role="dialog" aria-modal="true">
      <div className="prod-modal" onClick={e => e.stopPropagation()}>
        <button className="prod-modal-close" onClick={closeModal} aria-label="Close">✕</button>
        <div className="prod-modal-gallery">
          <div className="prod-modal-main-img-wrap" onClick={() => openLb(activeThumb)}>
            <img src={cloudinaryOptimize(images[activeThumb], { width: 1200 })} alt={`${name} — ${categoryList.join(', ')} product, image ${activeThumb + 1} | Shrivastavas Elevate, Satna MP`} className="prod-modal-main-img" />
            <div className="prod-modal-img-hint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
            </div>
          </div>
          {images.length > 1 && <div className="prod-modal-thumbs">{images.map((src, i) => <button key={i} className={`prod-modal-thumb${i === activeThumb ? ' active' : ''}`} onClick={() => setActiveThumb(i)} aria-label={`Image ${i + 1}`}><img src={cloudinaryOptimize(src, { width: 200 })} alt={`${name} thumbnail ${i + 1}`} /></button>)}</div>}
        </div>
        <div className="prod-modal-content">
          <div className="prod-modal-tag-row">
            {categoryList.map(cat => <span key={cat} className="prod-modal-tag">{cat}</span>)}
            {subcategory && <span className="prod-modal-tag prod-modal-tag--sub">{subcategory}</span>}
          </div>
          <h2 className="prod-modal-title">{name}</h2>
          {(material || finish) && (
            <div className="prod-modal-meta-chips">
              {material && <span className="prod-meta-chip"><IconLayerGroup /> {material}</span>}
              {finish   && <span className="prod-meta-chip"><IconInfo /> {finish}</span>}
            </div>
          )}
          {description && <div className="prod-modal-section"><h4 className="prod-modal-section-label">About this product</h4><p className="prod-modal-desc">{description}</p></div>}
          {specialities.length > 0 && (
            <div className="prod-modal-section"><h4 className="prod-modal-section-label">Specialities</h4>
              <div className="prod-spec-badges">
                {specialities.map((spec, i) => { const meta = SPEC_META[spec] || { Icon: IconCheck, color: '#c9a87c' }; return <span key={i} className="prod-spec-badge" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}4d`, color: meta.color }}><meta.Icon />{spec}</span>; })}
              </div>
            </div>
          )}
          {applications.length > 0 && <div className="prod-modal-section"><h4 className="prod-modal-section-label">Applications</h4><div className="prod-app-chips">{applications.map((app, i) => <span key={i} className="prod-app-chip"><IconCheck />{app}</span>)}</div></div>}
          {points.length > 0 && <div className="prod-modal-section"><h4 className="prod-modal-section-label">Key highlights</h4><ul className="prod-modal-points">{points.map((pt, i) => <li key={i} className="prod-modal-point"><span className="prod-point-dot" />{pt}</li>)}</ul></div>}
          <div className="prod-modal-cta">
            <button className="prod-modal-cta-btn" onClick={() => { closeModal(); openConsult(); }}>Get Free Consultation <IconCalendar /></button>
            <button className="prod-modal-close-btn" onClick={closeModal}>Close</button>
            <p className="prod-modal-cta-note">Our team will help you choose and source the right products for your project.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  const lightbox = lbIdx !== null && ReactDOM.createPortal(
    <div className="prod-lb-overlay" onClick={closeLb}>
      <button className="prod-lb-close" onClick={closeLb} aria-label="Close">✕</button>
      {images.length > 1 && <button className="prod-lb-arrow prod-lb-arrow--prev" onClick={lbPrev}>&#8249;</button>}
      <div className="prod-lb-img-wrap" onClick={e => e.stopPropagation()}>
        <img src={cloudinaryOptimize(images[lbIdx])} alt={`${name} — ${categoryList.join(', ')} product image ${lbIdx + 1} | Shrivastavas Elevate`} className="prod-lb-img" />
        <div className="prod-lb-caption"><span>{name}</span>{images.length > 1 && <span>{lbIdx + 1} / {images.length}</span>}</div>
      </div>
      {images.length > 1 && <button className="prod-lb-arrow prod-lb-arrow--next" onClick={lbNext}>&#8250;</button>}
    </div>,
    document.body
  );

  return <>{card}{modal}{lightbox}</>;
};

export default function ProductsPage({ initialProducts = [] }) {
  const { openConsult } = useModal();
  const [products,         setProducts]         = useState(initialProducts);
  const [loading,          setLoading]          = useState(initialProducts.length === 0);
  const [error,            setError]            = useState(false);
  const [activeCategory,   setActiveCategory]   = useState('All');
  const [activeSubcategory,setActiveSubcategory]= useState('All');
  const [query,            setQuery]            = useState('');
  const [currentPage,      setCurrentPage]      = useState(1);
  const ITEMS_PER_PAGE = 12;

  const fetchProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/product/list`);
      if (res.data.success) setProducts(res.data.data);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (initialProducts.length === 0) fetchProducts();
  }, [fetchProducts, initialProducts.length]);
  useWebSocket(useCallback((msg) => { if (msg.type === 'productsChanged') fetchProducts(); }, [fetchProducts]));

  const handleCategoryChange = (cat) => { setActiveCategory(cat); setActiveSubcategory('All'); };
  const getCategories = (p) => p.categories?.length ? p.categories : (p.category ? [p.category] : []);

  const filtered = products
    .filter(p => activeCategory === 'All' || getCategories(p).includes(activeCategory))
    .filter(p => activeSubcategory === 'All' || p.subcategory === activeSubcategory)
    .filter(p => !query || p.name.toLowerCase().includes(query.toLowerCase()) || (p.material || '').toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCurrentPage(1); }, [activeCategory, activeSubcategory, query]);

  const getPageRange = (cur, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (cur <= 4)         return [1, 2, 3, 4, 5, '…', total];
    if (cur >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', cur - 1, cur, cur + 1, '…', total];
  };

  const subcats = activeCategory !== 'All' ? SUBCATEGORIES[activeCategory] || [] : [];

  return (
    <div className="products-page">
      <div className="products-header">
        <div className="products-header-inner">
          <div className="products-header-left">
            <div className="prod-overline"><IconStore /> Our Products</div>
            <h2 className="products-heading">Product Catalogue</h2>
          </div>
          <div className="products-header-right">
            <p>Explore our curated range of architectural and design products — each one selected for beauty, durability, and real-world performance.</p>
            <div className="prod-header-bottom">
              <div className="prod-search-wrap">
                <IconSearch className="prod-search-icon" />
                <input type="text" placeholder="Search by name or material…" value={query} onChange={e => setQuery(e.target.value)} className="prod-search-input" />
                {query && <button className="prod-search-clear" onClick={() => setQuery('')}>×</button>}
              </div>
              <div className="prod-count-badge"><IconLayerGroup /> {filtered.length} product{filtered.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>
      </div>

      <nav className="prod-category-bar" aria-label="Product categories">
        {['All', ...CATEGORIES].map(cat => <button key={cat} className={`prod-cat-pill${activeCategory === cat ? ' active' : ''}`} onClick={() => handleCategoryChange(cat)}>{cat}</button>)}
      </nav>

      <div className="prod-cat-mobile">
        {['All', ...CATEGORIES].map(cat => <button key={cat} className={`prod-cat-chip${activeCategory === cat ? ' active' : ''}`} onClick={() => handleCategoryChange(cat)}>{cat}</button>)}
      </div>

      {subcats.length > 0 && (
        <div className="prod-subcat-bar">
          <button className={`prod-subcat-chip${activeSubcategory === 'All' ? ' active' : ''}`} onClick={() => setActiveSubcategory('All')}>All</button>
          {subcats.map(sub => <button key={sub} className={`prod-subcat-chip${activeSubcategory === sub ? ' active' : ''}`} onClick={() => setActiveSubcategory(sub)}>{sub}</button>)}
        </div>
      )}

      <div className="prod-body">
        <div className="products-grid">
          {loading ? (
            <div className="prod-empty"><div className="prod-empty-icon"><IconStore /></div><h3>Loading products…</h3></div>
          ) : error ? (
            <div className="prod-empty"><div className="prod-empty-icon"><IconStore /></div><h3>Couldn&apos;t load products</h3><p>Please check your connection and try refreshing.</p></div>
          ) : filtered.length > 0 ? (
            paginated.map(product => <ProductCard key={product._id} product={product} openConsult={openConsult} />)
          ) : (
            <div className="prod-empty"><div className="prod-empty-icon"><IconStore /></div><h3>No products here yet</h3><p>We&apos;re adding products to this section. Check back shortly.</p></div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="prod-pagination">
          <button className="prod-page-btn" disabled={currentPage === 1} onClick={() => { setCurrentPage(p => p - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>‹</button>
          {getPageRange(currentPage, totalPages).map((p, i) =>
            p === '…'
              ? <span key={`e${i}`} className="prod-page-ellipsis">…</span>
              : <button key={p} className={`prod-page-btn${p === currentPage ? ' active' : ''}`} onClick={() => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>{p}</button>
          )}
          <button className="prod-page-btn" disabled={currentPage === totalPages} onClick={() => { setCurrentPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>›</button>
        </div>
      )}

      <div className="prod-cta">
        <div className="prod-cta-inner">
          <div className="prod-cta-overline"><IconCrown /> Work With Us</div>
          <h2>Need Help Choosing?</h2>
          <p>Our design team will guide you through material selection, help you source the right products, and integrate them seamlessly into your project.</p>
          <button className="prod-cta-btn" onClick={openConsult}>Book Free Consultation <IconCalendar /></button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
