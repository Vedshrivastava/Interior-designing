'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faHome } from '@fortawesome/free-solid-svg-icons';

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f4ee',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem',
      fontFamily: '"Inter", sans-serif',
    }}>
      <p style={{
        fontFamily: '"Playfair Display", serif',
        fontSize: 'clamp(5rem, 15vw, 9rem)',
        fontWeight: 700,
        color: '#102525',
        lineHeight: 1,
        margin: '0 0 8px',
        letterSpacing: '-4px',
        opacity: 0.08,
      }}>404</p>

      <h1 style={{
        fontFamily: '"Playfair Display", serif',
        fontSize: 'clamp(1.8rem, 4vw, 3rem)',
        color: '#102525',
        margin: '0 0 14px',
        letterSpacing: '-0.5px',
      }}>
        Page Not Found
      </h1>

      <p style={{
        color: '#5a4e44',
        fontSize: '1rem',
        lineHeight: 1.7,
        maxWidth: '380px',
        margin: '0 0 36px',
      }}>
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: '12px 28px',
            background: 'transparent',
            border: '1px solid rgba(201,168,124,0.5)',
            borderRadius: '999px',
            color: '#102525',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.25s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#c9a87c'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(201,168,124,0.5)'}
        >
          <FontAwesomeIcon icon={faArrowLeft} /> Go Back
        </button>
        <Link
          href="/"
          style={{
            padding: '12px 28px',
            background: '#102525',
            border: 'none',
            borderRadius: '999px',
            color: '#c9a87c',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
          }}
        >
          <FontAwesomeIcon icon={faHome} /> Back to Home
        </Link>
      </div>
    </div>
  );
}
