
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './src/contexts/AuthContext'; // Import AuthProvider

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider> {/* Wrap App with AuthProvider */}
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
);
