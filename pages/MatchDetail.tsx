import React, { useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { MatchPrediction, MatchStatus, FootballPageData } from '../types';
import { SportIcon } from '../components/SportIcon';
import { Modal } from '../components/Modal';
import { getMatchStatus, safeNewDate } from '../utils/dateUtils';
import { ShareModal } from '../components/ShareModal';

export const MatchDetail: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const match = location.state?.match as MatchPrediction | undefined;
  
  const [isModalOpen, setModalOpen] = useState(false);
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [dataToShare, setDataToShare] = useState<Partial<FootballPageData> | null>(null);

  if (!match) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-brand-text mb-4">Match Details Not Found</h1>
        <p className="text-brand-text-secondary mb-6">The match details could not be loaded. Please go back and try again.</p>
        <Link to="/" className="bg-brand-primary text-white font-bold py-2 px-4 rounded-lg hover:bg-brand-primary-hover transition-colors">
          Go to Home
        </Link>
      </div>
    );
  }

  const handleShareClick = () => {
    if (match) {
        setDataToShare({ predictions: [match] });
        setShareModalOpen(true);
    }
  };

  const sport = match.sport;
  const { status } = getMatchStatus(match.matchDate);
  
  const statusConfig: Record<MatchStatus, { text: string; color: string; }> = {
    [MatchStatus.Upcoming]: { text: 'Upcoming', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    [MatchStatus.Live]: { text: 'Live Now', color: 'bg-red-100 text-red-700 border-red-200 animate-pulse' },
    [MatchStatus.Finished]: { text: 'Finished', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  };

  const currentStatus = statusConfig[status];

  return (
    <div>
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-brand-primary hover:text-brand-primary-hover transition-colors flex items-center gap-1 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to predictions
        </button>
      </div>
      
      <div className="bg-brand-surface backdrop-blur-sm rounded-xl shadow-lg p-8 border border-gray-200/50">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <SportIcon sport={sport} className="h-8 w-8 text-brand-primary"/>
              <h1 className="text-3xl font-bold text-brand-text">{match.teamA} vs {match.teamB}</h1>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${currentStatus.color}`}>
                  {currentStatus.text}
              </span>
            </div>
            <div className="text-md text-brand-text-secondary md:pl-11">
              <p>
                {safeNewDate(match.matchDate).getTime() !== 0 
                  ? safeNewDate(match.matchDate).toLocaleString('en-GH', { timeZone: 'Africa/Accra', dateStyle: 'full', timeStyle: 'short' })
                  : 'Date to be announced'
                }
              </p>
              {match.stadium && (
                <p className="flex items-center gap-1.5 mt-1">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 20l-4.95-6.05a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span>{match.stadium}{match.city ? `, ${match.city}` : ''}</span>
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 md:mt-0 flex flex-col items-stretch gap-2 w-full sm:w-auto">
              <div className="text-center bg-gray-100 rounded-md p-3 grid grid-cols-2 gap-2 border border-gray-200">
                 <div>
                    <p className="text-brand-text-secondary text-sm mb-1">Recommended Bet</p>
                    <p className="text-lg font-bold text-brand-primary">{match.recommendedBet}</p>
                  </div>
                   <div>
                    <p className="text-brand-text-secondary text-sm mb-1">Odds</p>
                    <p className="text-lg font-bold text-brand-primary">@{(match.odds || 0).toFixed(2)}</p>
                  </div>
              </div>
              <button
                  onClick={() => setModalOpen(true)}
                  className="text-sm text-center w-full bg-brand-secondary hover:bg-gray-200 border border-gray-200 text-brand-text font-semibold py-2 px-4 rounded-md transition-colors"
              >
                  Find Best Odds
              </button>
              <button
                onClick={handleShareClick}
                className="flex items-center justify-center gap-2 text-sm text-center w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md transition-colors"
                aria-label="Share to Telegram"
              >
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.789 0l-2 4a1 1 0 00.894 1.447h4a1 1 0 00.894-1.447l-2-4zM10 8a1 1 0 011 1v2.586l2.293 2.293a1 1 0 11-1.414 1.414L10 13.414V9a1 1 0 01-1-1z" /><path d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm2 0a6 6 0 1012 0 6 6 0 00-12 0z" /></svg>
                  Share to Telegram
              </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
          {/* Left Column - Prediction */}
          <div className="md:col-span-2">
            <h2 className="text-2xl font-bold text-brand-text mb-4">AI Analysis</h2>
            <div className="space-y-6">
              <div>
                <p className="font-semibold text-brand-text-secondary">AI Prediction</p>
                <p className="text-xl text-brand-text">{match.aiPrediction}</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                  <div className="bg-brand-primary h-2.5 rounded-full" style={{ width: `${(match.aiConfidence || 0)}%` }}></div>
                </div>
                <p className="text-xs font-bold text-right text-brand-primary mt-1">{(match.aiConfidence || 0).toFixed(1)}% Confidence</p>
              </div>
              <div>
                <p className="font-semibold text-brand-text-secondary">Learning Prediction</p>
                <p className="text-xl text-brand-text">{match.learningPrediction}</p>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                  <div className="bg-brand-accent-purple h-2.5 rounded-full" style={{ width: `${(match.learningConfidence || 0)}%` }}></div>
                </div>
                <p className="text-xs font-bold text-right text-brand-accent-purple mt-1">{(match.learningConfidence || 0).toFixed(1)}% Confidence</p>
              </div>
               {match.aiRationale && (
                  <div className="border-l-4 border-brand-primary/50 pl-4">
                    <p className="font-semibold text-brand-text-secondary">AI Rationale</p>
                    <p className="text-brand-text italic">"{match.aiRationale}"</p>
                  </div>
                )}
            </div>
          </div>
          
          {/* Right Column - Key Info */}
          <div className="md:col-span-1 bg-gray-500/10 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-brand-text mb-4">Match Info</h3>
            <div className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-2 text-sm text-brand-text">
                {match.formA && (
                    <>
                        <span className="font-semibold text-brand-text-secondary text-right">Form ({match.teamA}):</span>
                        <span className="font-mono text-left text-brand-text">{match.formA}</span>
                    </>
                )}
                 {match.formB && (
                    <>
                        <span className="font-semibold text-brand-text-secondary text-right">Form ({match.teamB}):</span>
                        <span className="font-mono text-left text-brand-text">{match.formB}</span>
                    </>
                )}
                {match.h2h && (
                    <>
                        <span className="font-semibold text-brand-text-secondary text-right">H2H (Last 5):</span>
                        <p className="text-left text-brand-text">{match.h2h}</p>
                    </>
                )}
                {match.keyStats && (
                    <>
                        <span className="font-semibold text-brand-text-secondary text-right">Key Stat:</span>
                        <p className="text-left text-brand-text">{match.keyStats}</p>
                    </>
                )}
            </div>
          </div>
        </div>
      </div>
      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Find Best Odds">
        <p className="text-sm text-brand-text-secondary mb-4">
            This feature will search our affiliate partners in real-time to find you the best available odds for this bet.
        </p>
        <div className="space-y-3">
            {/* Placeholder for affiliate links */}
            <div className="p-3 bg-brand-secondary rounded-md flex justify-between items-center">
                <span className="font-bold text-brand-text">Bet365</span>
                <span className="text-yellow-500">Searching...</span>
            </div>
            <div className="p-3 bg-brand-secondary rounded-md flex justify-between items-center">
                <span className="font-bold text-brand-text">William Hill</span>
                <span className="text-yellow-500">Searching...</span>
            </div>
            <div className="p-3 bg-brand-secondary rounded-md flex justify-between items-center">
                <span className="font-bold text-brand-text">888sport</span>
                <span className="text-yellow-500">Searching...</span>
            </div>
        </div>
        <p className="text-xs text-brand-text-secondary mt-4 italic">
            Note: This is a demonstration feature. Real-time odds comparison is coming soon.
        </p>
    </Modal>
    <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setShareModalOpen(false)}
        data={dataToShare}
        title={`AI Pick: ${match.teamA} vs ${match.teamB}`}
    />
    </div>
  );
};