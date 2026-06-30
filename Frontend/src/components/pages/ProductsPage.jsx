'use client';
import '@/styles/productsPage.css';
import { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import {
  IconStore, IconLayerGroup, IconCalendar, IconCalendarDays, IconCrown, IconStar, IconInfo,
  IconCheck, IconSearch, IconShield, IconScrewdriverWrench, IconPenRuler,
  IconDroplet, IconSun, IconFire, IconCloud, IconLeaf, IconVolumeX,
  IconThermometer, IconPen, IconGem, IconEye, IconLightbulb, IconBuilding,
} from '@/components/Icons';
import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { cloudinaryOptimize } from '@/lib/cloudinary';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Hardcoded fallback — used when DB hasn't loaded yet or for legacy data
const SPEC_META_FALLBACK = {
  'Waterproof':          { Icon: IconDroplet,          color: '#3b82f6' },
  'UV Protection':       { Icon: IconSun,              color: '#f59e0b' },
  'Fire Resistant':      { Icon: IconFire,             color: '#ef4444' },
  'Weather Resistant':   { Icon: IconCloud,            color: '#6366f1' },
  'Eco-Friendly':        { Icon: IconLeaf,             color: '#22c55e' },
  'Low Maintenance':     { Icon: IconScrewdriverWrench,color: '#8b5cf6' },
  'Anti-Fungal':         { Icon: IconShield,           color: '#14b8a6' },
  'Sound Insulation':    { Icon: IconVolumeX,          color: '#ec4899' },
  'Thermal Insulation':  { Icon: IconThermometer,      color: '#f97316' },
  'Scratch Resistant':   { Icon: IconShield,           color: '#64748b' },
  'Fade Resistant':      { Icon: IconSun,              color: '#a78bfa' },
  'Customizable':        { Icon: IconPen,              color: '#c9a87c' },
  'Non-Toxic':           { Icon: IconLeaf,             color: '#10b981' },
  'Rust Resistant':      { Icon: IconShield,           color: '#78716c' },
};

// Map icon key string (stored in DB) to React component
const ICON_COMPONENT_MAP = {
  'droplet':       IconDroplet,
  'sun':           IconSun,
  'fire':          IconFire,
  'cloud':         IconCloud,
  'leaf':          IconLeaf,
  'shield':        IconShield,
  'shield-halved': IconShield,
  'volume-off':    IconVolumeX,
  'thermometer':   IconThermometer,
  'pen':           IconPen,
  'check':         IconCheck,
  'circle-check':  IconCheck,
  'check-double':  IconCheck,
  'wrench':        IconScrewdriverWrench,
  'gear':          IconScrewdriverWrench,
  'gears':         IconScrewdriverWrench,
  'ruler':         IconPenRuler,
  'ruler-combined':IconPenRuler,
  'star':          IconStar,
  'gem':           IconGem,
  'crown':         IconCrown,
  'eye':           IconEye,
  'eye-slash':     IconEye,
  'lightbulb':     IconLightbulb,
  'recycle':       IconLeaf,
  'lock':          IconShield,
  'umbrella':      IconDroplet,
  'tint-slash':    IconDroplet,
  'fire-extinguisher': IconFire,
  'radiation':     IconSun,
  'snowflake':     IconThermometer,
  'wind':          IconCloud,
  'wind-free':     IconCloud,
  'seedling':      IconLeaf,
  'globe':         IconLeaf,
  'user-shield':   IconShield,
  'hard-hat':      IconShield,
  'ear-deaf':      IconVolumeX,
  'virus-slash':   IconShield,
  'bacteria':      IconShield,
  'biohazard':     IconShield,
  'hammer':        IconScrewdriverWrench,
  'cubes':         IconScrewdriverWrench,
  'layer-group':   IconLayerGroup,
  'rust':          IconShield,
  'wand':          IconPen,
  'palette':       IconPen,
  'paint-roller':  IconPen,
  'brush':         IconPen,
  'flask':         IconCheck,
  'vial':          IconCheck,
  'atom':          IconCheck,
  'feather':       IconCheck,
  'weight':        IconCheck,
  'bolt':          IconCheck,
  'plug':          IconCheck,
  'microchip':     IconCheck,
  'medal':         IconStar,
  'certificate':   IconCheck,
  'trophy':        IconCrown,
  'compress':      IconCheck,
  'expand':        IconCheck,
  'arrows-rotate': IconCheck,
  'fire-flame':    IconFire,
  'temperature-arrow-up':   IconThermometer,
  'temperature-arrow-down': IconThermometer,
  'magnet':        IconCheck,
  'clock':         IconCalendar,
  'hourglass':     IconCalendar,
  'infinity':      IconCheck,
  'cube':          IconCheck,
  'person-walking':IconCheck,
  'shoe-prints':   IconCheck,
  'moon':          IconCheck,
  'mirror':        IconEye,
  'building':      IconBuilding,
  'archway':       IconBuilding,
  'bug-slash':     IconShield,
  'bug':           IconCheck,
  'face-grin':     IconCheck,
  'industry':      IconBuilding,
  'truck':         IconBuilding,
  'arrows-alt':    IconCheck,
  'clipboard-check': IconCheck,
  'tag':           IconCheck,
  'money-bill':    IconCheck,
  'rotate':        IconCheck,
  'maximize':      IconCheck,
  'mask':          IconShield,
  'hand':          IconCheck,
  'hand-holding-heart': IconCheck,
  'heart':         IconCheck,
  'sun-plant-wilt':IconSun,
};

const ProductCard = ({ product, openConsult, specMeta = SPEC_META_FALLBACK, appMeta = {}, materialMeta = {}, finishMeta = {} }) => {
  const [modalOpen,   setModalOpen]   = useState(false);
  const [activeThumb, setActiveThumb] = useState(0);
  const [lbIdx,       setLbIdx]       = useState(null);

  const { name, description, images = [], categories, category, subcategories, subcategory, materials, material, finishes, finish, specialities = [], applications = [], points = [], isFeatured } = product;
  const categoryList = categories?.length ? categories : (category ? [category] : []);
  const materialList = materials?.length ? materials : (material ? [material] : []);
  const finishList   = finishes?.length  ? finishes  : (finish   ? [finish]   : []);
  const subcategoryList = subcategories?.length ? subcategories : (subcategory ? [subcategory] : []);

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
        {categoryList.length > 0 && (
          <div className="prod-card-chip-group">
            <p className="prod-card-chip-label">Category</p>
            <div className="prod-card-tags">
              {categoryList.map(cat => <span key={cat} className="prod-card-cat-tag">{cat}</span>)}
            </div>
          </div>
        )}
        {subcategoryList.length > 0 && (
          <div className="prod-card-chip-group">
            <p className="prod-card-chip-label">Subcategory</p>
            <div className="prod-card-tags">
              {subcategoryList.map(sub => <span key={sub} className="prod-card-subcat-tag">{sub}</span>)}
            </div>
          </div>
        )}
        <h3 className="prod-card-title">{name}</h3>
        <p className="prod-card-desc">{description}</p>
        {(materialList.length > 0 || finishList.length > 0) && (
          <div className="prod-card-chip-group">
            <p className="prod-card-chip-label">Material &amp; Finish</p>
            <div className="prod-card-chips">
              {materialList.map((m, i) => {
                const meta = materialMeta[m] || { color: '#c9a87c', iconUrl: null };
                return (
                  <span key={`m-${i}`} className="prod-chip" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}4d`, color: meta.color }}>
                    {meta.iconUrl ? <img src={meta.iconUrl} width={13} height={13} alt="" style={{ flexShrink: 0 }} /> : <IconLayerGroup />}
                    {m}
                  </span>
                );
              })}
              {finishList.map((f, i) => {
                const meta = finishMeta[f] || { color: '#c9a87c', iconUrl: null };
                return (
                  <span key={`f-${i}`} className="prod-chip" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}4d`, color: meta.color }}>
                    {meta.iconUrl ? <img src={meta.iconUrl} width={13} height={13} alt="" style={{ flexShrink: 0 }} /> : <IconStar />}
                    {f}
                  </span>
                );
              })}
            </div>
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
          <h2 className="prod-modal-title">{name}</h2>
          {categoryList.length > 0 && (
            <div className="prod-modal-section">
              <h4 className="prod-modal-section-label">Category</h4>
              <div className="prod-modal-tag-row">
                {categoryList.map(cat => <span key={cat} className="prod-modal-tag">{cat}</span>)}
              </div>
            </div>
          )}
          {subcategoryList.length > 0 && (
            <div className="prod-modal-section">
              <h4 className="prod-modal-section-label">Subcategory</h4>
              <div className="prod-modal-tag-row">
                {subcategoryList.map(sub => <span key={sub} className="prod-modal-tag prod-modal-tag--sub">{sub}</span>)}
              </div>
            </div>
          )}
          {materialList.length > 0 && (
            <div className="prod-modal-section">
              <h4 className="prod-modal-section-label">Material</h4>
              <div className="prod-modal-meta-chips">
                {materialList.map((m, i) => {
                  const meta = materialMeta[m] || { color: '#c9a87c', iconUrl: null };
                  return (
                    <span key={`m-${i}`} className="prod-meta-chip" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}4d`, color: meta.color }}>
                      {meta.iconUrl ? <img src={meta.iconUrl} width={13} height={13} alt="" style={{ flexShrink: 0 }} /> : <IconLayerGroup />} {m}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {finishList.length > 0 && (
            <div className="prod-modal-section">
              <h4 className="prod-modal-section-label">Finish</h4>
              <div className="prod-modal-meta-chips">
                {finishList.map((f, i) => {
                  const meta = finishMeta[f] || { color: '#c9a87c', iconUrl: null };
                  return (
                    <span key={`f-${i}`} className="prod-meta-chip" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}4d`, color: meta.color }}>
                      {meta.iconUrl ? <img src={meta.iconUrl} width={13} height={13} alt="" style={{ flexShrink: 0 }} /> : <IconInfo />} {f}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {description && <div className="prod-modal-section"><h4 className="prod-modal-section-label">About this product</h4><p className="prod-modal-desc">{description}</p></div>}
          {specialities.length > 0 && (
            <div className="prod-modal-section"><h4 className="prod-modal-section-label">Specialities</h4>
              <div className="prod-spec-badges">
                {specialities.map((spec, i) => {
                  const meta = specMeta[spec] || { Icon: IconCheck, color: '#c9a87c', iconUrl: null };
                  return (
                    <span key={i} className="prod-spec-badge" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}4d`, color: meta.color }}>
                      {meta.iconUrl
                        ? <img src={meta.iconUrl} width={13} height={13} alt="" style={{ flexShrink: 0 }} />
                        : <meta.Icon />
                      }
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
                {applications.map((app, i) => {
                  const meta = appMeta[app] || { color: '#c9a87c', iconUrl: null };
                  return (
                    <span key={i} className="prod-app-chip" style={{ background: `${meta.color}18`, border: `1px solid ${meta.color}4d`, color: meta.color }}>
                      {meta.iconUrl ? <img src={meta.iconUrl} width={13} height={13} alt="" style={{ flexShrink: 0 }} /> : <IconCheck />}
                      {app}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
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

  // specMeta: name → { iconUrl, color } — built from DB, falls back to hardcoded
  const [specMeta, setSpecMeta] = useState(() => {
    const m = {};
    Object.entries(SPEC_META_FALLBACK).forEach(([name, { Icon, color }]) => { m[name] = { Icon, color, iconUrl: null }; });
    return m;
  });

  // appMeta: name → { color, iconUrl } — built from DB
  const [appMeta, setAppMeta] = useState({});

  // materialMeta / finishMeta: name → { color, iconUrl } — built from DB
  const [materialMeta, setMaterialMeta] = useState({});
  const [finishMeta, setFinishMeta] = useState({});

  const fetchProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/product/list`);
      if (res.data.success) setProducts(res.data.data);
    } catch { setError(true); } finally { setLoading(false); }
  }, []);

  const fetchSpecialities = useCallback(() => {
    fetch(`${API_URL}/api/speciality/list`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.length > 0) {
          const map = {};
          d.data.forEach(s => {
            const isIconify = s.icon && s.icon.includes(':');
            const iconUrl = isIconify
              ? `https://api.iconify.design/${s.icon.replace(':', '/')}.svg?color=${encodeURIComponent(s.color)}`
              : null;
            const fallback = SPEC_META_FALLBACK[s.name];
            map[s.name] = { Icon: fallback?.Icon || IconCheck, color: s.color, iconUrl };
          });
          setSpecMeta(prev => ({ ...prev, ...map }));
        }
      })
      .catch(() => {});
  }, []);

  const APP_GOLD = '#c9a87c'; // applications always use the golden theme, not a custom colour

  const fetchApplications = useCallback(() => {
    fetch(`${API_URL}/api/application/list`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.length > 0) {
          const map = {};
          d.data.forEach(a => {
            const isIconify = a.icon && a.icon.includes(':');
            const iconUrl = isIconify
              ? `https://api.iconify.design/${a.icon.replace(':', '/')}.svg?color=${encodeURIComponent(APP_GOLD)}`
              : null;
            map[a.name] = { color: APP_GOLD, iconUrl };
          });
          setAppMeta(prev => ({ ...prev, ...map }));
        }
      })
      .catch(() => {});
  }, []);

  const fetchMaterialMeta = useCallback(() => {
    fetch(`${API_URL}/api/material/list`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.length > 0) {
          const map = {};
          d.data.forEach(m => {
            const isIconify = m.icon && m.icon.includes(':');
            const iconUrl = isIconify
              ? `https://api.iconify.design/${m.icon.replace(':', '/')}.svg?color=${encodeURIComponent(m.color)}`
              : null;
            map[m.name] = { color: m.color, iconUrl };
          });
          setMaterialMeta(prev => ({ ...prev, ...map }));
        }
      })
      .catch(() => {});
  }, []);

  const fetchFinishMeta = useCallback(() => {
    fetch(`${API_URL}/api/finish/list`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.length > 0) {
          const map = {};
          d.data.forEach(f => {
            const isIconify = f.icon && f.icon.includes(':');
            const iconUrl = isIconify
              ? `https://api.iconify.design/${f.icon.replace(':', '/')}.svg?color=${encodeURIComponent(f.color)}`
              : null;
            map[f.name] = { color: f.color, iconUrl };
          });
          setFinishMeta(prev => ({ ...prev, ...map }));
        }
      })
      .catch(() => {});
  }, []);

  const [productCategories,    setProductCategories]    = useState([]);
  const [productSubcategories, setProductSubcategories] = useState([]);

  const fetchProductCategories = useCallback(() => {
    fetch(`${API_URL}/api/product-category/list`)
      .then(r => r.json())
      .then(d => { if (d.success) setProductCategories(d.data || []); })
      .catch(() => {});
  }, []);

  const fetchProductSubcategories = useCallback(() => {
    fetch(`${API_URL}/api/product-subcategory/list`)
      .then(r => r.json())
      .then(d => { if (d.success) setProductSubcategories(d.data || []); })
      .catch(() => {});
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (initialProducts.length === 0) fetchProducts();
    fetchSpecialities();
    fetchApplications();
    fetchProductCategories();
    fetchProductSubcategories();
    fetchMaterialMeta();
    fetchFinishMeta();
  }, [fetchProducts, fetchSpecialities, fetchApplications, fetchProductCategories, fetchProductSubcategories, fetchMaterialMeta, fetchFinishMeta, initialProducts.length]);

  useWebSocket(useCallback((msg) => {
    // Also re-fetch specialities/applications/materials/finishes on productsChanged — a new
    // product may reference a value created moments earlier in the same admin
    // session, and the WebSocket events can arrive/resolve out of order.
    if (msg.type === 'productsChanged')           { fetchProducts(); fetchSpecialities(); fetchApplications(); fetchMaterialMeta(); fetchFinishMeta(); }
    if (msg.type === 'specialitiesChanged')         fetchSpecialities();
    if (msg.type === 'applicationsChanged')         fetchApplications();
    if (msg.type === 'productCategoriesChanged')    fetchProductCategories();
    if (msg.type === 'productSubcategoriesChanged') fetchProductSubcategories();
    if (msg.type === 'materialsChanged')            fetchMaterialMeta();
    if (msg.type === 'finishesChanged')             fetchFinishMeta();
  }, [fetchProducts, fetchSpecialities, fetchApplications, fetchProductCategories, fetchProductSubcategories, fetchMaterialMeta, fetchFinishMeta]));

  const handleCategoryChange = (cat) => { setActiveCategory(cat); setActiveSubcategory('All'); };
  const getCategories = (p) => p.categories?.length ? p.categories : (p.category ? [p.category] : []);
  const getSubcategories = (p) => p.subcategories?.length ? p.subcategories : (p.subcategory ? [p.subcategory] : []);

  const filtered = products
    .filter(p => activeCategory === 'All' || getCategories(p).includes(activeCategory))
    .filter(p => activeSubcategory === 'All' || getSubcategories(p).includes(activeSubcategory))
    .filter(p => {
      if (!query) return true;
      const q = query.toLowerCase();
      const materialList = p.materials?.length ? p.materials : (p.material ? [p.material] : []);
      return p.name.toLowerCase().includes(q) || materialList.some(m => m.toLowerCase().includes(q));
    })
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

  const subcats = activeCategory !== 'All'
    ? productSubcategories.filter(s => s.categories?.includes(activeCategory)).map(s => s.name)
    : [];
  const categoryNames = productCategories.map(c => c.name);

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
        {['All', ...categoryNames].map(cat => <button key={cat} className={`prod-cat-pill${activeCategory === cat ? ' active' : ''}`} onClick={() => handleCategoryChange(cat)}>{cat}</button>)}
      </nav>

      <div className="prod-cat-mobile">
        {['All', ...categoryNames].map(cat => <button key={cat} className={`prod-cat-chip${activeCategory === cat ? ' active' : ''}`} onClick={() => handleCategoryChange(cat)}>{cat}</button>)}
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
            paginated.map(product => <ProductCard key={product._id} product={product} openConsult={openConsult} specMeta={specMeta} appMeta={appMeta} materialMeta={materialMeta} finishMeta={finishMeta} />)
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
