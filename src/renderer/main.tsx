import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Renderer entry point. Mounts the React application into the root element.
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root was not found in the document.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
