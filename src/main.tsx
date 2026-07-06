import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ApiKeyGate} from './components/ApiKeyGate.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiKeyGate>
      <App />
    </ApiKeyGate>
  </StrictMode>,
);
