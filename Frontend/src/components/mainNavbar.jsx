'use client';
import '@/styles/mainNavbar.css';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import logo from '@/assets/logo.png';
import { IconCalendar, IconGem, IconEnvelope, IconChevronRight } from '@/components/Icons';
import { useModal } from '@/context/ModalContext';

/* Medal/Award icon for "About" — not in Icons.jsx, inline here */
const IconMedal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="1em" height="1em">
    <path d="M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
    <path d="M12 15v6M8 21h8" />
    <path d="m9 8.5 1.5 1.5L12 8l1.5 2L15 8.5" />
  </svg>
);

const NAV_LINKS = [
  { label: 'Services', to: '/services',                 matchPath: null,      mobileHide: false, Icon: IconGem,     desc: 'What we offer'    },
  { label: 'Designs',  to: '/design/Kitchen%20Designs', matchPath: '/design', mobileHide: true,  Icon: null,        desc: null               },
  { label: 'Products', to: '/products',                 matchPath: null,      mobileHide: true,  Icon: null,        desc: null               },
  { label: 'Projects', to: '/projects',                 matchPath: null,      mobileHide: true,  Icon: null,        desc: null               },
  { label: 'About',    to: '/about',                    matchPath: null,      mobileHide: false, Icon: IconMedal,   desc: 'Our story & team' },
  { label: 'Contact',  to: '/contact',                  matchPath: null,      mobileHide: false, Icon: IconEnvelope,desc: 'Get in touch'     },
];

export default function MainNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const navRef   = useRef(null);
  const { openConsult } = useModal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <nav className="mainNavbar" ref={navRef}>
      <div className={`mainNavbar-container${scrolled ? ' scrolled' : ''}`}>
        <Link href="/" className="mainNavbar-logo" onClick={() => setMenuOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image src={logo} alt="Shrivastava's Elevate" width={40} height={40} priority />
          <div className="mainNavbar-logo-text">
            <strong>Shrivastava&apos;s</strong>
            <span>Elevate</span>
          </div>
        </Link>

        <div className={`mainNavbar-links-container${menuOpen ? ' open' : ''}`}>
          <ul className="mainNavbar-links">
            {NAV_LINKS.map(({ label, to, matchPath, mobileHide, Icon, desc }) => {
              const isActive = matchPath
                ? pathname.startsWith(matchPath)
                : pathname === to;
              return (
                <li key={to} className={mobileHide ? 'nav-mobile-hidden' : ''}>
                  <Link href={to} className={isActive ? 'active-link' : ''}>
                    {Icon && (
                      <span className="nav-link-icon-wrap">
                        <Icon />
                      </span>
                    )}
                    <span className="nav-link-text-wrap">
                      <span className="nav-link-label">{label}</span>
                      {desc && <span className="nav-link-desc">{desc}</span>}
                    </span>
                    {Icon && <IconChevronRight className="nav-link-chevron" />}
                  </Link>
                </li>
              );
            })}

            <li className="nav-mobile-hidden">
              <button
                className="consult-online"
                onClick={() => { openConsult(); setMenuOpen(false); }}
              >
                Consult Online <IconCalendar />
              </button>
            </li>
          </ul>
        </div>

        <div
          className={`hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setMenuOpen(v => !v)}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </div>
      </div>
    </nav>
  );
}
