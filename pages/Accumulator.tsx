import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchAccumulatorStrategySets } from '../services/geminiService';
import { AccumulatorTip, GroundingChunk, FootballPageData, AccumulatorStrategySets } from '../types';
import { useFavorites } from '../contexts/FavoritesContext';
import AccumulatorCard from '../components/AccumulatorCard';
import SourceList from '../components/SourceList';
import AccumulatorCardSkeleton from '../components/AccumulatorCardSkeleton';
import AILoadingState from '../components/AILoadingState';
import { StakeModal } from '../components/StakeModal';
import { ShareModal } from '../components/ShareModal';
import { FortressIcon, GoalRushIcon, ShieldIcon, UnderdogIcon } from '../components/icons';

const STRATEGY_METADATA: Record<string, { title: string; icon: React.ReactNode; description: string; }> = {
    homeFortress: { 
        title: "Home Fortress", 
        icon: <FortressIcon className="h-6 w-6 text-brand-primary" />,
        description: "A low-to-medium risk accumulator focusing on strong home favorites with a high probability of winning."
    },
    goalRush: { 
        title: "Goal Rush", 
        icon: <GoalRushIcon className="h-6 w-6 text-brand-primary" />,
        description: "A medium-risk slip targeting matches with a high probability of 'Over 2.5 Goals' or 'Both Teams to Score'."
    },
    underdogHunt: { 
        title: "Underdog Hunt", 
        icon: <UnderdogIcon className="h-6 w-6 text-brand-primary" />,
        description: "A high-risk, high-reward accumulator looking for undervalued away teams or draws with a fighting chance."
    },
    cautiousPlay: { 
        title: "Cautious Play", 
        icon: <ShieldIcon className="h-6 w-6 text-brand-primary" />,
        description: "A low-risk accumulator using very safe markets like 'Double Chance' for high-probability outcomes."
    }
};

const StrategySection: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, description, icon, children }) => (
    <div className="mb-12">
        <div className="flex items-start gap-4 mb-3">
            <div>{icon}</div>
            <div>
                <h2 className="text-2xl font-bold text-brand-text">{title}</h2>
                <p className="text-brand-text-secondary text-sm mt-1">{description}</p>
            </div>
        </div>
        {children}
    </div>
);


const Accumulator: React.FC = () => {
  const [strategySets, setStrategySets] = useState<AccumulatorStrategySets | null>(null);
  const [sources, setSources] = useState<GroundingChunk[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { trackedAccumulators, addAccumulator, removeAccumulator } = useFavorites();

  const [isStakeModalOpen, setStakeModalOpen] = useState(false);
  const [itemToFavorite, setItemToFavorite] = useState<AccumulatorTip | null>(null);
  
  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [dataToShare, setDataToShare] = useState<Partial<FootballPageData> | null>(null);

  const loadTips = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      const { data, sources: newSources } = await fetchAccumulatorStrategySets(forceRefresh);
      setStrategySets(data);
      setSources(newSources);
    } catch (err) {
      setError('Failed to fetch accumulator tips. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTips(false);
  }, [loadTips]);

  const handleToggleTrack = (tipId: string) => {
    const isTracked = trackedAccumulators.some(a => a.id === tipId);
    if (isTracked) {
        if (window.confirm("Are you sure you want to untrack this accumulator? It will be removed from your dashboard.")) {
            removeAccumulator(tipId);
        }
    } else {
        if (!strategySets) return;
        const allTips = Object.values(strategySets).filter((tip): tip is AccumulatorTip => tip !== null);
        const tipToFavorite = allTips.find(t => t.id === tipId);
        if (tipToFavorite) {
            setItemToFavorite(tipToFavorite);
            setStakeModalOpen(true);
        }
    }
  };

  const handleStakeSubmit = (stake: number) => {
    if (itemToFavorite && stake > 0) {
      addAccumulator(itemToFavorite, stake);
    }
    setItemToFavorite(null);
    setStakeModalOpen(false);
  };
  
  const handleShareClick = () => {
    if (!strategySets) return;
    const allTips = Object.values(strategySets).filter((tip): tip is AccumulatorTip => tip !== null);
    setDataToShare({ accumulators: allTips });
    setShareModalOpen(true);
  };

  const allTips = useMemo(() => {
    if (!strategySets) return [];
    return Object.values(strategySets).filter((tip): tip is AccumulatorTip => tip !== null);
  }, [strategySets]);

  const renderContent = () => {
    if (loading) {
      return (
        <>
          <AILoadingState messages={['Searching for today\'s best tips...', 'Analyzing odds with Google Search...', 'Building accumulator strategies...']} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[...Array(4)].map((_, index) => <AccumulatorCardSkeleton key={index} />)}
          </div>
        </>
      );
    }

    if (error) {
      return <p className="text-red-500 bg-red-100 p-4 rounded-md text-center">{error}</p>;
    }
    
    if (!strategySets || allTips.length === 0) {
      return (
        <div className="text-center py-16 px-6 bg-brand-surface backdrop-blur-sm rounded-xl border border-gray-200/50">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-brand-text">No Accumulator Tips Found</h3>
          <p className="mt-1 text-sm text-brand-text-secondary">
            The AI could not generate any strategies for today's games. Please try refreshing or check back later.
          </p>
        </div>
      );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            {Object.entries(strategySets).map(([key, tip]) => {
                const metadata = STRATEGY_METADATA[key];
                if (!metadata) return null;

                return (
                    <StrategySection key={key} title={metadata.title} description={metadata.description} icon={metadata.icon}>
                        {tip ? (
                            <AccumulatorCard
                                tip={tip}
                                onToggleTrack={() => handleToggleTrack(tip.id)}
                                isTracked={trackedAccumulators.some(a => a.id === tip.id)}
                                virtualStake={trackedAccumulators.find(a => a.id === tip.id)?.virtualStake}
                            />
                        ) : (
                            <div className="text-center p-6 bg-gray-500/10 rounded-lg border-2 border-dashed border-gray-200">
                                <p className="text-brand-text-secondary">AI could not find suitable matches for this strategy today.</p>
                            </div>
                        )}
                    </StrategySection>
                );
            })}
        </div>
    );
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-brand-text mb-2">AI Accumulator Strategies</h1>
          <p className="text-brand-text-secondary mb-4 sm:mb-0">Themed accumulator sets for today's games, generated by our advanced AI.</p>
        </div>
        <div className="flex items-center gap-2">
            <button
              onClick={() => loadTips(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors bg-brand-primary text-white hover:bg-brand-primary-hover disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
              aria-label="Refresh accumulator tips"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4a8 8 0 0113.142 5.5M20 20a8 8 0 00-13.142-5.5" />
              </svg>
              {loading ? 'Refreshing...' : 'Refresh Tips'}
            </button>
            <button
                onClick={handleShareClick}
                disabled={loading || allTips.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
                aria-label="Share Accumulator Tips to Telegram"
            >
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.789 0l-2 4a1 1 0 00.894 1.447h4a1 1 0 00.894-1.447l-2-4zM10 8a1 1 0 011 1v2.586l2.293 2.293a1 1 0 11-1.414 1.414L10 13.414V9a1 1 0 01-1-1z" /><path d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm2 0a6 6 0 1012 0 6 6 0 00-12 0z" /></svg>
                Share All
            </button>
        </div>
      </div>
      
      {!loading && sources.length > 0 && <SourceList sources={sources} />}
      
      {renderContent()}

      <StakeModal
        isOpen={isStakeModalOpen}
        onClose={() => setStakeModalOpen(false)}
        onSubmit={handleStakeSubmit}
        itemName={itemToFavorite?.name}
      />
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setShareModalOpen(false)}
        data={dataToShare}
        title="Today's AI Accumulator Strategies"
      />
    </div>
  );
};

export default Accumulator;