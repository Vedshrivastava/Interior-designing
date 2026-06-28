'use client';
import '@/styles/testimonials.css';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconQuoteLeft, IconStarFilled, IconArrowRight, IconXMark, IconCrown, IconCalendar } from '@/components/Icons';
import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';

const FALLBACK = [
  { name: 'Rahul Mehta',    location: 'Mumbai',    rating: 5, text: 'Exceptional execution and genuinely luxurious finishing. Every material, proportion and detail was considered, and the finished space matched the 3D render they showed us months earlier almost exactly. That kind of accuracy is rare.' },
  { name: 'Priya Sharma',   location: 'Delhi',     rating: 5, text: 'Their design sense is outstanding. Every corner of our apartment feels premium and considered, like the space was always meant to look this way. They listened carefully to how we actually live and you can see that in the result.' },
  { name: 'Aman Verma',     location: 'Bangalore', rating: 5, text: 'Professional, transparent and highly skilled. I could see every finish and furniture placement in the 3D before work started, which gave me real confidence going in. The execution matched it perfectly with no surprises at all.' },
  { name: 'Neha Joshi',     location: 'Pune',      rating: 5, text: 'From the first consultation to handover, the whole process was smooth and genuinely stress-free. They handled every contractor, delivery and site call. I just showed up on handover day and walked into a finished home.' },
  { name: 'Vikram Singh',   location: 'Indore',    rating: 5, text: 'We got a genuinely luxurious interior within our budget, with no compromise on quality or finish. The materials are premium and the craftsmanship is immaculate. Two other designers had quoted us more for a noticeably lower standard of work.' },
  { name: 'Sunita Agarwal', location: 'Bhopal',    rating: 5, text: 'The 3D renders were absolutely spot-on. We knew exactly what we were getting before any work started, which took away all the usual anxiety. The finished space is identical to what we approved in the render. That level of accuracy is rare.' },
];

const truncate = text => text.length > 120 ? text.slice(0, 117).trimEnd() + '…' : text;

const GoogleBadge = ({ reviewsUrl }) => (
  <a
    href={reviewsUrl || '#'}
    target="_blank"
    rel="noopener noreferrer"
    className="tr-google-badge"
    onClick={e => e.stopPropagation()}
    title="View on Google"
  >
    <svg viewBox="0 0 24 24" className="tr-google-icon">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    <span>Google</span>
  </a>
);

export default function TestimonialsPage() {
  const router = useRouter();
  const { openConsult } = useModal();
  const [adminReviews,  setAdminReviews]  = useState(FALLBACK);
  const [googleReviews, setGoogleReviews] = useState([]);
  const [googleUrl,     setGoogleUrl]     = useState('');
  const [active,        setActive]        = useState(null);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL;
    Promise.all([
      fetch(`${API}/api/testimonial/list?activeOnly=true`).then(r => r.json()).catch(() => null),
      fetch(`${API}/api/testimonial/google`).then(r => r.json()).catch(() => null),
    ]).then(([adminData, googleData]) => {
      if (adminData?.success) setAdminReviews(adminData.data?.length > 0 ? adminData.data : FALLBACK);
      if (googleData?.success && googleData.data?.length > 0) {
        setGoogleReviews(googleData.data);
        setGoogleUrl(googleData.reviewsUrl || '');
      }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (active) document.body.style.overflow = 'hidden';
    else        document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [active]);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') setActive(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const allReviews = [...adminReviews, ...googleReviews];

  return (
    <div className="tr-page">

      {/* ── Modal ── */}
      {active && (
        <div className="t-modal-backdrop" onClick={() => setActive(null)}>
          <div className="t-modal t-modal--light" onClick={e => e.stopPropagation()}>
            <button className="t-modal-close" onClick={() => setActive(null)} aria-label="Close"><IconXMark /></button>
            <div className="t-modal-stars">{Array.from({ length: active.rating }).map((_, i) => <IconStarFilled key={i} />)}</div>
            <p className="t-modal-text">{active.text}</p>
            <div className="t-modal-author">
              <div className="t-modal-avatar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {active.image ? <img src={active.image.src || active.image} alt={active.name} /> : active.name.charAt(0)}
              </div>
              <div className="t-modal-author-info">
                <strong>{active.name}</strong>
                <span>{active.location}</span>
              </div>
            </div>
            {active.isGoogle && <GoogleBadge reviewsUrl={active.reviewsUrl || googleUrl} />}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <section className="tr-header">
        <span className="tr-overline"><IconQuoteLeft /> Client Reviews</span>
        <h1 className="tr-title">What Our Clients Say</h1>
        <p className="tr-sub">
          Real reviews from homeowners and businesses across India who trusted<br />
          Shrivastavas Elevate with their spaces.
        </p>
        {googleReviews.length > 0 && googleUrl && (
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="tr-google-link">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            See all Google reviews
          </a>
        )}
      </section>

      {/* ── Grid ── */}
      <section className="tr-grid-section">
        {loading ? (
          <div className="tr-loading">Loading reviews…</div>
        ) : (
          <div className="tr-grid">
            {allReviews.map((t, i) => (
              <div
                key={t._id || `g${i}`}
                className={`tr-card${t.isGoogle ? ' tr-card--google' : ''}`}
                onClick={() => setActive(t)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActive(t)}
              >
                <div className="tr-card-top">
                  <div className="tr-card-stars">
                    {Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}
                  </div>
                  {t.isGoogle && <GoogleBadge reviewsUrl={t.reviewsUrl || googleUrl} />}
                </div>
                <p className="tr-card-text">{truncate(t.text)}</p>
                <div className="tr-card-author">
                  <div className="tr-card-avatar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t.image
                      ? <img src={t.image.src || t.image} alt={t.name} />
                      : t.name.charAt(0)
                    }
                  </div>
                  <div className="tr-card-info">
                    <strong>{t.name}</strong>
                    <span>{t.isGoogle ? t.time : t.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── CTA ── */}
      <section className="tr-cta-section">
        <div className="tr-cta-inner">
          <span className="tr-cta-tag"><IconCrown /> Begin Your Journey</span>
          <h2>Your Space<br />Could Be Next!</h2>
          <p>Every review above started with one conversation. Book a free consultation and let&apos;s start yours.</p>
          <button className="tr-cta-btn" onClick={openConsult}>
            Book Free Consultation <IconCalendar />
          </button>
          <div>
            <button className="tr-cta-back" onClick={() => router.push('/')}>
              <IconArrowRight style={{ transform: 'rotate(180deg)' }} /> Back to Home
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
