import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Football from './pages/Football';
import Leagues from './pages/Leagues';
import Accumulator from './pages/Accumulator';
import AIGenerator from './pages/AIGenerator';
import About from './pages/About';
import { MatchDetail } from './pages/MatchDetail';
import ResponsibleGambling from './pages/ResponsibleGambling';
import { Dashboard } from './pages/Dashboard';
import { Learning } from './pages/Learning';
import ScrollToTop from './components/ScrollToTop';
import { config } from './config';
import { ApiKeyNeededOverlay } from './components/ApiKeyNeededOverlay';
import { DatabaseSetupNeededOverlay } from './components/DatabaseSetupNeededOverlay';
import { useFavorites, FavoritesProvider } from './contexts/FavoritesContext';
import ParticlesBackground from './components/ParticlesBackground';
import { GeminiApiKeyNeededOverlay } from './components/GeminiApiKeyNeededOverlay';

const AppContent: React.FC = () => {
  const { error, clearError } = useFavorites();

  if (error === 'DATABASE_TABLES_MISSING') {
    return <DatabaseSetupNeededOverlay />;
  }
  
  return (
    <div className="flex flex-col min-h-screen">
      {error && error !== 'DATABASE_TABLES_MISSING' && (
        <div className="bg-red-100 border-b border-red-300 text-red-800 p-3 text-center sticky top-0 z-50 flex justify-between items-center shadow-lg dark:bg-red-900/50 dark:text-red-300 dark:border-red-700/50" role="alert">
          <p className="flex-grow text-sm font-semibold">{error}</p>
          <button 
            onClick={clearError} 
            className="ml-4 p-1 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50 focus:outline-none focus:ring-2 focus:ring-red-400"
            aria-label="Dismiss error message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/football" element={<Football />} />
          <Route path="/leagues" element={<Leagues />} />
          <Route path="/accumulator" element={<Accumulator />} />
          <Route path="/generator/custom" element={<AIGenerator />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/learning" element={<Learning />} />
          <Route path="/about" element={<About />} />
          <Route path="/match-detail" element={<MatchDetail />} />
          <Route path="/responsible-gambling" element={<ResponsibleGambling />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

const App: React.FC = () => {
  const geminiApiKey = import.meta.env && import.meta.env.VITE_API_KEY;

  if (!geminiApiKey || geminiApiKey === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
    return <GeminiApiKeyNeededOverlay />;
  }
  
  // We now check for placeholder values in the Supabase config. If they are present,
  // we show an overlay prompting the user to add their credentials. This prevents
  // the app from trying to fetch from an invalid URL.
  if (config.supabaseUrl.trim() === 'https://placeholder.supabase.co' || !config.supabaseUrl.trim() || config.supabaseAnonKey.trim() === 'YOUR_SUPABASE_ANON_KEY' || !config.supabaseAnonKey.trim()) {
    return <ApiKeyNeededOverlay />;
  }
  
  return (
    <HashRouter>
      <ScrollToTop />
      <ParticlesBackground />
      <FavoritesProvider>
        <AppContent />
      </FavoritesProvider>
    </HashRouter>
  );
};

export default App;