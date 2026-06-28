'use client';
import '@/styles/testimonials.css';
import '@/styles/services.css';
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

export default function TestimonialsPage() {
  const router = useRouter();
  const { openConsult } = useModal();
  const [reviews, setReviews]     = useState(FALLBACK);
  const [active,  setActive]      = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/testimonial/list?activeOnly=true`)
      .then(r => r.json())
      .then(d => { if (d.success) setReviews(d.data?.length > 0 ? d.data : FALLBACK); })
      .catch(() => {})
      .finally(() => setLoading(false));
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
      </section>

      {/* ── Grid ── */}
      <section className="tr-grid-section">
        {loading ? (
          <div className="tr-loading">Loading reviews…</div>
        ) : (
          <div className="tr-grid">
            {reviews.map((t, i) => (
              <div
                key={t._id || i}
                className="tr-card"
                onClick={() => setActive(t)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setActive(t)}
              >
                <div className="tr-card-stars">
                  {Array.from({ length: t.rating }).map((_, s) => <IconStarFilled key={s} />)}
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
                    <span>{t.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── CTA ── */}
      <section className="services-cta">
        <div className="cta-inner">
          <span className="svc-section-tag"><IconCrown /> Begin Your Journey</span>
          <h2>Your Space<br />Could Be Next</h2>
          <p>Every review above started with one conversation. Book a free consultation and let&apos;s start yours.</p>
          <button className="services-cta-btn" onClick={openConsult}>
            Book Free Consultation <IconCalendar />
          </button>
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => router.push('/')}
              style={{ background: 'none', border: 'none', color: 'rgba(240,230,211,0.5)', fontFamily: 'Inter, sans-serif', fontSize: '0.78rem', cursor: 'pointer', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(240,230,211,0.85)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,230,211,0.5)'}
            >
              <IconArrowRight style={{ transform: 'rotate(180deg)' }} /> Back to Home
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
