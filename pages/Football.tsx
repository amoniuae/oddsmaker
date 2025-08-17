import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchFootballPageData } from '../services/geminiService';
import { MatchPrediction, GroundingChunk, AccumulatorTip, FootballPageData } from '../types';
import MatchPredictionCard from '../components/MatchPredictionCard';
import AccumulatorCard from '../components/AccumulatorCard';
import AILoadingState from '../components/AILoadingState';
import SourceList from '../components/SourceList';
import { isTodayGH, isTomorrowGH, safeNewDate } from '../utils/dateUtils';
import { StakeModal } from '../components/StakeModal';
import { useFavorites } from '../contexts/FavoritesContext';
import { ShareModal } from '../components/ShareModal';
import { SparklesIcon, RefreshIcon, ShareIcon } from '../components/icons';

// Separate loading messages for better UX
const LOADING_MESSAGES = [
  'Fetching football match schedules...',
  'Using Google Search to verify games...',
  'Building predictions & accumulators...',
  'Analyzing team statistics and form...',
  'Calculating odds and recommendations...'
] as const;

// Error messages enum for consistency
enum ErrorType {
  FETCH_ERROR = 'Failed to fetch football data. The AI returned an unexpected response.',
  NETWORK_ERROR = 'Network error occurred. Please check your connection and try again.',
  GENERIC_ERROR = 'An error occurred while fetching football data. Please try again later.'
}

interface FootballProps {
  className?: string;
}

export default function Football({ className = '' }: FootballProps): React.ReactElement {
  // Core data state
  const [footballData, setFootballData] = useState<FootballPageData | null>(null);
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  
  // UI state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Modal state
  const [isStakeModalOpen, setStakeModalOpen] = useState(false);
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [itemToFavorite, setItemToFavorite] = useState<MatchPrediction | AccumulatorTip | null>(null);

  // Favorites context
  const { 
    trackedPredictions, 
    trackedAccumulators, 
    addPrediction, 
    removePrediction,
    addAccumulator,
    removeAccumulator
  } = useFavorites();

  // Memoized computed values for better performance
  const { todayPredictions, tomorrowPredictions, validAccumulators } = useMemo(() => {
    const predictions = footballData?.predictions || [];
    const accumulators = footballData?.accumulators || [];
    
    return {
      todayPredictions: predictions.filter(p => isTodayGH(safeNewDate(p.matchDate))),
      tomorrowPredictions: predictions.filter(p => isTomorrowGH(safeNewDate(p.matchDate))),
      validAccumulators: accumulators.filter(tip => tip?.games?.length > 0)
    };
  }, [footballData]);

  // Check if sharing is available
  const canShare = useMemo(() => 
    todayPredictions.length > 0 || validAccumulators.length > 0, 
    [todayPredictions.length, validAccumulators.length]
  );

  // Enhanced data fetching with better error handling
  const loadPageData = useCallback(async (forceRefresh = false) => {
    const isRefresh = forceRefresh && !loading;
    
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);

    try {
      const { data, sources: newSources } = await fetchFootballPageData(forceRefresh);
      
      // Handle null response gracefully by setting an empty state, not throwing an error.
      // This is a valid scenario if the AI finds no games.
      setFootballData(data || { predictions: [], accumulators: [] });
      setSources(newSources || []);

    } catch (err) {
      console.error('Football data fetch error:', err);
      
      if (err instanceof Error) {
        if (err.message.includes('network') || err.message.includes('fetch')) {
          setError(ErrorType.NETWORK_ERROR);
        } else if (err.message === ErrorType.FETCH_ERROR) {
          setError(ErrorType.FETCH_ERROR);
        } else {
          setError(ErrorType.GENERIC_ERROR);
        }
      } else {
        setError(ErrorType.GENERIC_ERROR);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading]);

  // Initial load - runs only once on mount to prevent loops
  useEffect(() => {
    loadPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enhanced toggle tracking with better UX
  const handleToggleTrack = useCallback((itemId: string, itemType: 'prediction' | 'accumulator') => {
    const isTracked = itemType === 'prediction' 
      ? trackedPredictions.some(p => p.id === itemId)
      : trackedAccumulators.some(a => a.id === itemId);

    if (isTracked) {
      const confirmMessage = `Remove this ${itemType} from your tracking dashboard?`;
      if (window.confirm(confirmMessage)) {
        if (itemType === 'prediction') {
          removePrediction(itemId);
        } else {
          removeAccumulator(itemId);
        }
      }
      return;
    }

    // Find item to track
    let itemToTrack: MatchPrediction | AccumulatorTip | undefined;
    
    if (itemType === 'prediction') {
      itemToTrack = [...todayPredictions, ...tomorrowPredictions].find(p => p.id === itemId);
    } else {
      const allTips = [...validAccumulators];
      // Add bet builders from predictions
      [...todayPredictions, ...tomorrowPredictions].forEach(p => {
        if (p.betBuilder) allTips.push(p.betBuilder);
      });
      itemToTrack = allTips.find(a => a.id === itemId);
    }
    
    if (itemToTrack) {
      setItemToFavorite(itemToTrack);
      setStakeModalOpen(true);
    }
  }, [todayPredictions, tomorrowPredictions, validAccumulators, trackedPredictions, trackedAccumulators, removePrediction, removeAccumulator]);

  // Handle stake modal submission
  const handleStakeSubmit = useCallback((stake: number) => {
    if (!itemToFavorite || stake <= 0) return;

    if ('aiPrediction' in itemToFavorite) {
      addPrediction(itemToFavorite, stake);
    } else {
      addAccumulator(itemToFavorite, stake);
    }

    setItemToFavorite(null);
    setStakeModalOpen(false);
  }, [itemToFavorite, addPrediction, addAccumulator]);
  
  // Get item name for modal
  const itemNameForModal = useMemo(() => {
    if (!itemToFavorite) return undefined;
    
    return 'aiPrediction' in itemToFavorite
      ? `${itemToFavorite.teamA} vs ${itemToFavorite.teamB} (${itemToFavorite.recommendedBet})`
      : itemToFavorite.name;
  }, [itemToFavorite]);
  
  // Handle share functionality
  const handleShareClick = useCallback(() => {
    const dataToShare: Partial<FootballPageData> = {};
    
    if (todayPredictions.length > 0) {
      dataToShare.predictions = todayPredictions;
    }
    
    if (validAccumulators.length > 0) {
      dataToShare.accumulators = validAccumulators;
    }
    
    setShareModalOpen(true);
  }, [todayPredictions, validAccumulators]);

  // Render predictions section
  const renderPredictions = useCallback((
    title: string, 
    games: MatchPrediction[], 
    showShareButton = false
  ) => (
    <section className="mb-12" aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-heading`}>
      <div className="flex justify-between items-center mb-6 pb-3 border-b-2 border-brand-primary">
        <h2 
          id={`${title.toLowerCase().replace(/\s+/g, '-')}-heading`}
          className="text-2xl font-bold text-brand-text"
        >
          {title}
        </h2>
        {showShareButton && (
          <button
            onClick={handleShareClick}
            disabled={loading || refreshing || !canShare}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Share today's football predictions to Telegram"
          >
            <ShareIcon className="h-4 w-4" />
            Share Today's Picks
          </button>
        )}
      </div>
      
      {games.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {games.map((match) => {
            const isPredTracked = trackedPredictions.some(p => p.id === match.id);
            const isAccaTracked = match.betBuilder ? trackedAccumulators.some(a => a.id === match.betBuilder!.id) : false;
            const predictionStake = trackedPredictions.find(p => p.id === match.id)?.virtualStake;
            const accumulatorStake = match.betBuilder ? trackedAccumulators.find(a => a.id === match.betBuilder!.id)?.virtualStake : undefined;
            
            return (
              <Link 
                key={match.id} 
                to="/match-detail" 
                state={{ match }} 
                className="block no-underline transform transition-transform duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 rounded-lg"
                aria-label={`View details for ${match.teamA} vs ${match.teamB}`}
              >
                <MatchPredictionCard 
                  match={match} 
                  onToggleTrack={handleToggleTrack}
                  isTracked={isPredTracked}
                  isAccumulatorTracked={isAccaTracked}
                  virtualStake={predictionStake}
                  accumulatorStake={accumulatorStake}
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 px-6 bg-brand-surface/50 backdrop-blur-sm rounded-xl border border-gray-200/50">
          <p className="text-brand-text-secondary text-lg">No matches scheduled for {title.toLowerCase()}.</p>
        </div>
      )}
    </section>
  ), [handleToggleTrack, handleShareClick, trackedPredictions, trackedAccumulators, loading, refreshing, canShare]);

  // Render accumulators section
  const renderAccumulators = useCallback(() => (
    <section className="mt-16" aria-labelledby="accumulators-heading">
      <div className="mb-8">
        <h2 id="accumulators-heading" className="text-3xl font-bold text-brand-text mb-3 flex items-center gap-3">
          <SparklesIcon className="h-8 w-8 text-brand-primary animate-pulse" />
          AI-Generated Accumulators
        </h2>
        <p className="text-brand-text-secondary text-lg leading-relaxed">
          Our advanced AI combines the most promising predictions into strategic, high-value accumulator bets 
          designed to maximize your potential returns.
        </p>
      </div>
      
      {validAccumulators.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {validAccumulators.map((tip) => {
            const trackedData = trackedAccumulators.find(a => a.id === tip.id);
            return (
              <div key={tip.id} className="transform transition-transform duration-200 hover:scale-105">
                <AccumulatorCard 
                  tip={tip} 
                  onToggleTrack={() => handleToggleTrack(tip.id, 'accumulator')} 
                  isTracked={!!trackedData}
                  virtualStake={trackedData?.virtualStake}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-8 bg-gradient-to-br from-brand-surface/30 to-brand-surface/60 backdrop-blur-sm rounded-2xl border border-gray-200/50">
          <div className="max-w-md mx-auto">
            <SparklesIcon className="mx-auto h-16 w-16 text-gray-300 mb-6" />
            <h3 className="text-xl font-semibold text-brand-text mb-3">
              Building Perfect Combinations
            </h3>
            <p className="text-brand-text-secondary leading-relaxed">
              Our AI is analyzing today's matches to create the most profitable accumulator combinations. 
              Only high-confidence, strategic bets will appear here.
            </p>
          </div>
        </div>
      )}
    </section>
  ), [validAccumulators, trackedAccumulators, handleToggleTrack]);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header Section */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-4xl font-bold text-brand-text mb-2 bg-gradient-to-r from-brand-primary to-blue-600 bg-clip-text text-transparent">
            AI Football Predictions
          </h1>
          <p className="text-brand-text-secondary text-lg leading-relaxed">
            Advanced AI analysis of today's and tomorrow's matches using real-time data and statistical models.
          </p>
        </div>
        
        <button
          onClick={() => loadPageData(true)}
          disabled={loading || refreshing}
          className="flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 bg-brand-primary text-white hover:bg-brand-primary-hover hover:scale-105 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 shadow-lg hover:shadow-xl"
          aria-label={refreshing ? 'Refreshing predictions' : 'Refresh football predictions'}
        >
          <RefreshIcon className={`h-5 w-5 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : loading ? 'Loading...' : 'Refresh Predictions'}
        </button>
      </header>

      {/* Loading State */}
      {loading && !refreshing && (
        <AILoadingState messages={LOADING_MESSAGES} />
      )}

      {/* Sources */}
      {!loading && sources.length > 0 && (
        <SourceList sources={sources} />
      )}
      
      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center" role="alert">
          <div className="text-red-600 font-medium mb-2">Unable to Load Predictions</div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => loadPageData(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && (
        <main>
          {todayPredictions.length === 0 && tomorrowPredictions.length === 0 && validAccumulators.length === 0 ? (
            <div className="text-center py-16 px-8 bg-brand-surface/30 backdrop-blur-sm rounded-2xl border border-gray-200/50">
              <h3 className="text-2xl font-semibold text-brand-text mb-3">No Predictions Available</h3>
              <p className="text-brand-text-secondary text-lg mb-6">
                The AI couldn't find any high-confidence predictions or accumulators for today or tomorrow. Please check back later.
              </p>
              <button
                onClick={() => loadPageData(true)}
                className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors"
              >
                Check for Updates
              </button>
            </div>
          ) : (
            <>
              {renderPredictions("Today's Matches", todayPredictions, true)}
              {renderPredictions("Tomorrow's Matches", tomorrowPredictions)}
              {renderAccumulators()}
            </>
          )}
        </main>
      )}

      {/* Modals */}
      <StakeModal
        isOpen={isStakeModalOpen}
        onClose={() => setStakeModalOpen(false)}
        onSubmit={handleStakeSubmit}
        itemName={itemNameForModal}
      />
      
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setShareModalOpen(false)}
        data={todayPredictions.length > 0 || validAccumulators.length > 0 ? { 
          predictions: todayPredictions, 
          accumulators: validAccumulators 
        } : null}
        title="Today's AI Football Picks"
      />
    </div>
  );
}
