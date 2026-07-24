import React from 'react';
import { createRoot } from 'react-dom/client';
import { EmsaApp } from '@/components/emsa/EmsaApp';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EmsaApp />
  </React.StrictMode>
);
