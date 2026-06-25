'use client';
import { createContext, useContext, useState } from 'react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [showConsult, setShowConsult] = useState(false);
  const [showQuote, setShowQuote] = useState(false);
  const [consultData, setConsultData] = useState(null);

  const openConsult = () => setShowConsult(true);
  const closeConsult = () => setShowConsult(false);

  const openQuote = (data) => {
    setConsultData(data);
    setShowQuote(true);
  };
  const closeQuote = () => {
    setShowQuote(false);
    setConsultData(null);
  };

  return (
    <ModalContext.Provider value={{ showConsult, openConsult, closeConsult, showQuote, openQuote, closeQuote, consultData }}>
      {children}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);
