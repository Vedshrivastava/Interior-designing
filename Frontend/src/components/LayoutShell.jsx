'use client';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { IconWhatsApp } from '@/components/Icons';
import MainNavbar from './MainNavbar';
import BottomNavbar from './BottomNavbar';
import Consult from './Consult';
import QuotePopup from './QuotePopup';
import { useModal } from '@/context/ModalContext';

export default function LayoutShell({ children }) {
  const { showConsult, showQuote } = useModal();

  return (
    <>
      <MainNavbar />
      <BottomNavbar />

      {showConsult && <Consult />}
      {showQuote && <QuotePopup />}

      {children}

      <a
        href="https://wa.me/918962053372"
        target="_blank"
        rel="noopener noreferrer"
        className="wa-fab"
        aria-label="Chat with us on WhatsApp"
      >
        <span className="wa-fab-pulse" />
        <IconWhatsApp className="wa-fab-icon" />
        <span className="wa-fab-label">Chat with us</span>
      </a>

      <ToastContainer position="bottom-center" autoClose={3000} theme="dark" />
    </>
  );
}
