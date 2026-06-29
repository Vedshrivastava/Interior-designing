'use client';
import '@/styles/projects.css';
import { useEffect, useState, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';


import Footer from '@/components/Footer';
import { useModal } from '@/context/ModalContext';
import { useWebSocket } from '@/hooks/useWebSocket';
import { IconBuilding, IconHouseChimney, IconLayerGroup, IconCalendar, IconCrown, IconLocation, IconRulerCombined, IconClock, IconCalendarDays, IconQuoteLeft, IconStar, IconStarFilled, IconKey, IconArrowRight } from '@/components/Icons';

import { cloudinaryOptimize } from '@/lib/cloudinary';
import ProjectCard from '@/components/ProjectCard';

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

/* ─── Projects page ───────────────────────────────────────────── */
export default function ProjectsPage({ initialProjects = [] }) {
  const { openConsult } = useModal();
  const [projects,     setProjects]     = useState(initialProjects);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading,      setLoading]      = useState(initialProjects.length === 0);
  const [error,        setError]        = useState(false);
  const [projectTypes, setProjectTypes] = useState(['Residential', 'Commercial']);

  const fetchProjectTypes = useCallback(() => {
    fetch(`${API_URL}/api/project-type/list`)
      .then(r => r.json())
      .then(d => { if (d.success && d.data?.length > 0) setProjectTypes(d.data.map(t => t.name)); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchProjectTypes(); }, [fetchProjectTypes]);

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (initialProjects.length === 0) fetchProjects();
  }, [fetchProjects, initialProjects.length]);

  useWebSocket(useCallback((msg) => {
    if (msg.type === 'projectsChanged')     fetchProjects();
    if (msg.type === 'projectTypesChanged') fetchProjectTypes();
  }, [fetchProjects, fetchProjectTypes]));

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
          { val: '7+',   label: 'Years Experienced Team'    },
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

        {/* Filter tabs — scrollable pill bar */}
        <div className="proj-type-scroll-bar">
          {['All', ...projectTypes].map(f => (
            <button
              key={f}
              className={`proj-type-pill${activeFilter === f ? ' active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f === 'Residential' && <IconHouseChimney />}
              {f === 'Commercial'  && <IconBuilding />}
              {f}{f !== 'All' && ` (${projects.filter(p => p.projectType === f).length})`}
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
