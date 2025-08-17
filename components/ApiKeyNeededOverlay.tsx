import React from 'react';

export const ApiKeyNeededOverlay: React.FC = () => {
  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl text-center bg-slate-800 p-6 sm:p-8 rounded-lg border border-red-500/50 shadow-2xl shadow-red-500/20">
        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-red-400 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-red-400 mb-4">Configuration Required</h1>
        <p className="text-base sm:text-lg text-slate-300 mb-6">
          The application cannot connect to the database because the Supabase URL or API key is missing.
        </p>
        <div className="text-left bg-slate-900 p-4 sm:p-6 rounded-lg font-mono text-xs sm:text-sm">
          <p className="text-slate-400 mb-2">// To fix this:</p>
          <p className="mb-3">1. Create a <code className="bg-yellow-400/20 text-yellow-300 px-2 py-1 rounded">.env.local</code> file in the root of your project.</p>
          <p className="mb-3">2. Add the following lines to the file, replacing placeholders with your Supabase credentials:</p>
          <pre className="p-3 bg-slate-950 rounded text-cyan-300 whitespace-pre-wrap">
{`VITE_SUPABASE_URL="YOUR_SUPABASE_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"`}
          </pre>
          <p className="text-slate-400 mt-3">3. You can find these keys in your Supabase project settings under "API".</p>
        </div>
        <p className="text-slate-500 mt-6 text-sm">
          After adding the keys, you may need to restart your development server.
        </p>
      </div>
    </div>
  );
};
