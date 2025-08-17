import React, { useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FavoritePrediction, FavoriteAccumulator, PredictionResult, AccumulatorResult, DailyBriefing, PortfolioAnalysis, HydratedStrategy } from '../types';
import { useFavorites } from '../contexts/FavoritesContext';
import { fetchSingleScore, fetchDailyBriefing, fetchPortfolioAnalysis } from '../services/geminiService';
import MatchPredictionCard from '../components/MatchPredictionCard';
import AccumulatorCard from '../components/AccumulatorCard';
import PerformanceChart from '../components/PerformanceChart';
import { exportToCsv } from '../utils/exportUtils';
import { Modal } from '../components/Modal';
import BreakdownTabs, { BreakdownData } from '../components/BreakdownTabs';
import Achievements, { Achievement } from '../components/Achievements';
import { ChartPieIcon, CrownIcon, FireIcon, RocketIcon, SparklesIcon, TrophyIcon, ClipboardDocIcon, BanknotesIcon, ChartBarIcon, StarIcon, ClipboardListIcon, ArrowTrendingUpIcon, TweakIcon, MagnifyingGlassIcon, LightBulbIcon } from '../components/icons';
import Spinner from '../components/Spinner';
import RiskIndicator from '../components/RiskIndicator';
import { BudgetManager } from '../components/BudgetManager';
import { safeNewDate } from '../utils/dateUtils';

const BriefingItem: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; }> = ({ icon, title, children }) => (
    <div className="bg-brand-bg/50 p-4 rounded-md flex items-start gap-4">
        <div className="flex-shrink-0 mt-1">{icon}</div>
        <div>
            <h4 className="font-semibold text-brand-text mb-1">{title}</h4>
            <div className="text-sm text-brand-text-secondary">{children}</div>
        </div>
    </div>
);

const DailyBriefingCard: React.FC<{ briefing: DailyBriefing | null, isLoading: boolean, onRefresh: () => void }> = ({ briefing, isLoading, onRefresh }) => {
    return (
        <div className="bg-brand-surface p-6 rounded-lg shadow-lg border-t-4 border-brand-primary">
            <div className="flex justify-between items-center gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <ClipboardListIcon className="h-8 w-8 text-brand-primary"/>
                    <h2 className="text-2xl font-bold text-white">AI Daily Briefing</h2>
                </div>
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-brand-secondary text-brand-text-secondary hover:bg-opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                     <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4a8 8 0 0113.142 5.5M20 20a8 8 0 00-13.142-5.5" />
                    </svg>
                    {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            {isLoading && !briefing ? (
                 <div className="flex items-center justify-center h-48"><Spinner size="md"/></div>
            ) : briefing ? (
                <div className="space-y-4">
                    <BriefingItem icon={<ArrowTrendingUpIcon className="h-5 w-5 text-green-400"/>} title="Market Opportunity">
                        <p>{briefing.marketOpportunity}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                           <span>Confidence: <strong className="text-green-400">{briefing.confidenceScore}%</strong></span>
                        </div>
                    </BriefingItem>
                    <BriefingItem icon={<StarIcon className="h-5 w-5 text-yellow-400"/>} title="Performance Highlight">
                        <p>{briefing.performanceHighlight}</p>
                    </BriefingItem>
                     <BriefingItem icon={<TweakIcon className="h-5 w-5 text-blue-400"/>} title="Strategy Suggestion">
                        <p>{briefing.strategySuggestion}</p>
                         <div className="flex items-center gap-4 mt-2 text-xs">
                           <span>Suggested Risk: <RiskIndicator level={briefing.riskLevel} /></span>
                        </div>
                    </BriefingItem>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-brand-secondary/50">
                        <div>
                            <h4 className="font-semibold text-brand-text mb-2 text-sm">📈 Market Trends</h4>
                            <ul className="list-disc list-inside space-y-1 text-xs text-brand-text-secondary">
                                {briefing.marketTrends.map((trend, i) => <li key={i}>{trend}</li>)}
                            </ul>
                        </div>
                        <div>
                             <h4 className="font-semibold text-brand-text mb-2 text-sm">💡 Learning Insights</h4>
                            <ul className="list-disc list-inside space-y-1 text-xs text-brand-text-secondary">
                                {briefing.learningInsights.map((insight, i) => <li key={i}>{insight}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            ) : (
                 <p className="text-sm text-center text-brand-text-secondary py-8">Could not load daily briefing.</p>
            )}
        </div>
    );
};

const PortfolioAnalysisCard: React.FC<{ 
    pendingPredictions: FavoritePrediction[], 
    pendingAccumulators: FavoriteAccumulator[] 
}> = ({ pendingPredictions, pendingAccumulators }) => {
    const [analysis, setAnalysis] = useState<PortfolioAnalysis | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const hasPendingBets = pendingPredictions.length > 0 || pendingAccumulators.length > 0;

    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        setAnalysis(null);
        try {
            const result = await fetchPortfolioAnalysis(pendingPredictions, pendingAccumulators);
            if (result) {
                setAnalysis(result);
            } else {
                setError("The AI could not generate an analysis for your current portfolio.");
            }
        } catch (err) {
            console.error("Failed to fetch portfolio analysis:", err);
            setError("An unexpected error occurred during analysis.");
        } finally {
            setIsLoading(false);
        }
    };

    const renderContent = () => {
        if (!hasPendingBets) {
            return (
                <div className="text-center py-8">
                    <p className="text-brand-text-secondary">You have no pending bets to analyze.</p>
                    <Link to="/football" className="text-brand-primary underline mt-2 inline-block">Track a new bet</Link>
                </div>
            );
        }

        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-48">
                    <Spinner size="md" />
                    <p className="mt-4 text-brand-text-secondary">AI is analyzing your portfolio...</p>
                </div>
            );
        }
        
        if (error) {
             return (
                <div className="text-center py-8 px-4 bg-red-900/20 rounded-md">
                    <p className="text-red-400">{error}</p>
                    <button onClick={handleAnalyze} className="mt-4 text-sm font-semibold bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                        Try Again
                    </button>
                </div>
            );
        }

        if (analysis) {
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                        <div className="bg-brand-bg/50 p-4 rounded-md">
                           <p className="text-sm text-brand-text-secondary">Overall Confidence & Risk</p>
                           <div className="flex justify-center items-center gap-4 mt-1">
                                <p className="text-3xl font-bold text-green-400">{analysis.portfolioConfidence}%</p>
                                <RiskIndicator level={analysis.portfolioRiskLevel} />
                           </div>
                        </div>
                         <div className="bg-brand-bg/50 p-4 rounded-md">
                           <p className="text-sm text-brand-text-secondary">Linchpin Bet</p>
                           <p className="text-lg font-bold text-brand-text truncate mt-1" title={analysis.linchpinBet.description}>{analysis.linchpinBet.description}</p>
                        </div>
                    </div>
                     <BriefingItem icon={<StarIcon className="h-5 w-5 text-yellow-400"/>} title="Linchpin Rationale">
                        <p>{analysis.linchpinBet.rationale}</p>
                    </BriefingItem>
                    <BriefingItem icon={<MagnifyingGlassIcon className="h-5 w-5 text-red-400"/>} title="Hidden Risk">
                        <p>{analysis.hiddenRisk}</p>
                    </BriefingItem>
                    <BriefingItem icon={<LightBulbIcon className="h-5 w-5 text-blue-400"/>} title="Hedge Suggestion">
                        <p><strong>Bet:</strong> {analysis.hedgeSuggestion.bet}</p>
                        <p><strong>Rationale:</strong> {analysis.hedgeSuggestion.rationale}</p>
                    </BriefingItem>
                    <button onClick={handleAnalyze} className="w-full text-sm font-semibold bg-blue-600/80 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors">
                        Re-Analyze Portfolio
                    </button>
                </div>
            );
        }

        return (
             <div className="text-center py-8">
                <p className="text-brand-text-secondary mb-4">Let the AI review your pending bets for hidden risks and insights.</p>
                <button onClick={handleAnalyze} className="flex items-center justify-center gap-3 w-full sm:w-auto mx-auto bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-500 transition-colors">
                    <MagnifyingGlassIcon className="h-6 w-6" />
                    Analyze My Pending Bets
                </button>
            </div>
        );
    };

    return (
        <div className="bg-brand-surface p-6 rounded-lg shadow-lg border-t-4 border-blue-500">
            <div className="flex items-center gap-3 mb-4">
                <MagnifyingGlassIcon className="h-8 w-8 text-blue-400"/>
                <h2 className="text-2xl font-bold text-white">AI Portfolio Analyst</h2>
            </div>
            {renderContent()}
        </div>
    );
};


const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <div className="bg-brand-surface p-4 rounded-lg shadow-lg flex items-start gap-3">
        <div className="bg-brand-secondary p-2 rounded-lg text-brand-primary">
            {icon}
        </div>
        <div>
            <p className="text-sm text-brand-text-secondary">{title}</p>
            <p className="text-xl font-bold text-white">{value}</p>
        </div>
    </div>
);


const FilterButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      isActive ? 'bg-brand-primary text-white font-semibold' : 'bg-brand-secondary text-brand-text-secondary hover:bg-opacity-80'
    }`}
  >
    {label}
  </button>
);

const getItemDate = (item: FavoritePrediction | FavoriteAccumulator): Date => {
    if ('matchDate' in item && item.matchDate) { // It's a FavoritePrediction
        return safeNewDate(item.matchDate);
    }
    if ('games' in item && item.games && item.games.length > 0) { // It's a FavoriteAccumulator
        return item.games.reduce((latest, game) => {
            const gameDate = safeNewDate(game.matchDate);
            return gameDate > latest ? gameDate : latest;
        }, new Date(0));
    }
    return new Date(0); // Fallback for items without a date
};

export const Dashboard: React.FC = () => {
  const { 
      trackedPredictions, 
      trackedAccumulators, 
      strategies,
      isLoading: favoritesLoading,
      removePrediction, 
      removeAccumulator,
      clearAllTrackedBets,
      predictionResults,
      accumulatorResults,
      isResultsLoading,
      pnlHistory,
      performanceStats,
      pendingPredictions,
      settledPredictions,
  } = useFavorites();
  
  const [checkingResultId, setCheckingResultId] = useState<string | null>(null);
  const [isClearModalOpen, setClearModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'predictions' | 'accumulators'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'settled'>('all');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc'>('date_desc');
  
  const [dailyBriefing, setDailyBriefing] = useState<DailyBriefing | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(true);

  const loadBriefing = useCallback(async () => {
    if (favoritesLoading || !strategies) return;
    setIsBriefingLoading(true);
    try {
        const briefing = await fetchDailyBriefing(strategies);
        setDailyBriefing(briefing);
    } catch (error) {
        console.error("Failed to fetch daily briefing for dashboard:", error);
        setDailyBriefing(null);
    } finally {
        setIsBriefingLoading(false);
    }
  }, [strategies, favoritesLoading]);

  // UseEffect to load briefing on mount and when strategies change
  React.useEffect(() => {
      loadBriefing();
  }, [loadBriefing]);

  const handleCheckResult = useCallback(async (matchId: string) => {
    const match = trackedPredictions.find(p => p.id === matchId);
    if (!match) return;
    
    setCheckingResultId(matchId);
    try {
      // This is a placeholder for the actual single fetch logic, 
      // which should be added to the context if needed or kept here.
      // For now, it refetches all.
      await fetchSingleScore(match);
    } catch (error) {
        console.error(`Failed to fetch single score for match ${matchId}:`, error);
    } finally {
      setCheckingResultId(null);
    }
  }, [trackedPredictions]);

  const breakdownData = useMemo((): BreakdownData => {
    const byBetType = settledPredictions.reduce((acc, p) => {
        const betType = p.recommendedBet;
        if (!acc[betType]) {
            acc[betType] = { name: betType, bets: 0, wins: 0, pnl: 0 };
        }
        acc[betType].bets++;
        const pnl = pnlHistory[p.id] || 0;
        acc[betType].pnl += pnl;
        if (pnl > 0) {
            acc[betType].wins++;
        }
        return acc;
    }, {} as Record<string, { name: string; bets: number; wins: number; pnl: number }>);

    const byLeague = settledPredictions.reduce((acc, p) => {
        const league = p.league || 'Unknown League';
        if (!acc[league]) {
            acc[league] = { name: league, bets: 0, wins: 0, pnl: 0 };
        }
        acc[league].bets++;
        const pnl = pnlHistory[p.id] || 0;
        acc[league].pnl += pnl;
        if (pnl > 0) {
            acc[league].wins++;
        }
        return acc;
    }, {} as Record<string, { name: string; bets: number; wins: number; pnl: number }>);
    
    return {
      byBetType: Object.values(byBetType).sort((a,b) => b.pnl - a.pnl),
      byLeague: Object.values(byLeague).sort((a,b) => b.pnl - a.pnl),
    }
  }, [settledPredictions, pnlHistory]);
  
  const unlockedAchievements = useMemo((): Achievement[] => {
      const achievements: Achievement[] = [];
      const wonBets = settledPredictions.filter(p => predictionResults[p.id]?.betOutcome === 'Won');
      const settledAccumulators = trackedAccumulators.filter(a => accumulatorResults[a.id]?.finalOutcome);
      const wonAccas = settledAccumulators.filter(a => accumulatorResults[a.id]?.finalOutcome === 'Won');

      if (wonBets.length + wonAccas.length > 0) achievements.push({ id: 'first_win', title: 'First Win!', description: 'You won your first tracked bet.', icon: <TrophyIcon className="h-6 w-6" /> });
      if (performanceStats.totalBets >= 10 && performanceStats.totalPnl > 0) achievements.push({ id: 'consistent_performer', title: 'Consistent Performer', description: 'Tracked 10+ bets with a positive P/L.', icon: <RocketIcon className="h-6 w-6" /> });
      if (wonBets.some(p => (p.odds || 0) > 5.0) || wonAccas.some(a => (a.combinedOdds || 0) > 5.0)) achievements.push({ id: 'high_roller', title: 'High Roller', description: 'Won a bet with odds over 5.0.', icon: <SparklesIcon className="h-6 w-6" /> });
      if (wonAccas.some(a => (a.games || []).length >= 3)) achievements.push({ id: 'accumulator_king', title: 'Accumulator King', description: 'Won an accumulator with 3+ legs.', icon: <CrownIcon className="h-6 w-6" /> });
      
      const sortedSettled = [...settledPredictions, ...settledAccumulators].sort((a,b) => getItemDate(a).getTime() - getItemDate(b).getTime());
      
      let streak = 0;
      for (const item of sortedSettled) {
          const result = 'recommendedBet' in item ? predictionResults[item.id]?.betOutcome : accumulatorResults[item.id]?.finalOutcome;
          if (result === 'Won') streak++; else streak = 0;
          if (streak >= 3) break;
      }
      if (streak >= 3) achievements.push({ id: 'on_a_roll', title: 'On a Roll', description: 'Achieved a winning streak of 3+ bets.', icon: <FireIcon className="h-6 w-6" /> });

      return achievements;
  }, [settledPredictions, predictionResults, trackedAccumulators, accumulatorResults, performanceStats.totalBets, performanceStats.totalPnl]);


    const filteredAndSortedItems = useMemo(() => {
        const allItems: (FavoritePrediction | FavoriteAccumulator)[] = [...trackedPredictions, ...trackedAccumulators];

        const filtered = allItems.filter(item => {
            if (activeTab === 'predictions' && !('recommendedBet' in item)) return false;
            if (activeTab === 'accumulators' && 'recommendedBet' in item) return false;
            
            const result = 'recommendedBet' in item ? predictionResults[item.id] : accumulatorResults[item.id];
            const outcome = result && ('betOutcome' in result) ? result.betOutcome : (result && 'finalOutcome' in result) ? result.finalOutcome : null;

            if (statusFilter === 'pending' && outcome) return false;
            if (statusFilter === 'settled' && !outcome) return false;

            return true;
        });

        return filtered.sort((a, b) => {
            const dateA = getItemDate(a).getTime();
            const dateB = getItemDate(b).getTime();
            return sortOrder === 'date_desc' ? dateB - dateA : dateA - dateB;
        });

    }, [trackedPredictions, trackedAccumulators, predictionResults, accumulatorResults, activeTab, statusFilter, sortOrder]);


  return (
    <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <p className="text-brand-text-secondary mt-1">Your personal betting performance tracker.</p>
            </div>
            <button
                onClick={() => {
                    const dataToExport = [...settledPredictions, ...trackedAccumulators.filter(a => accumulatorResults[a.id])].map(item => {
                        const isPrediction = 'recommendedBet' in item;
                        const pnl = pnlHistory[item.id] || 0;
                        const result = isPrediction ? predictionResults[item.id] : accumulatorResults[item.id];
                        return {
                            id: item.id,
                            type: isPrediction ? 'Prediction' : 'Accumulator',
                            name: isPrediction ? `${item.teamA} vs ${item.teamB}` : item.name,
                            bet: isPrediction ? item.recommendedBet : 'Accumulator',
                            date: getItemDate(item).toISOString(),
                            stake: item.virtualStake,
                            odds: isPrediction ? item.odds : item.combinedOdds,
                            outcome: isPrediction ? (result as PredictionResult)?.betOutcome : (result as AccumulatorResult)?.finalOutcome,
                            pnl: pnl.toFixed(2),
                        };
                    });
                    exportToCsv(
                        `ai-predictor-export-${new Date().toISOString().split('T')[0]}.csv`, 
                        dataToExport,
                        [
                            { key: 'date', label: 'Date' },
                            { key: 'type', label: 'Type' },
                            { key: 'name', label: 'Name' },
                            { key: 'bet', label: 'Bet' },
                            { key: 'stake', label: 'Stake' },
                            { key: 'odds', label: 'Odds' },
                            { key: 'outcome', label: 'Outcome' },
                            { key: 'pnl', label: 'P/L' },
                        ]
                    );
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors bg-brand-surface text-brand-text-secondary hover:bg-brand-secondary"
            >
                <ClipboardDocIcon className="h-5 w-5" />
                Export Settled Bets
            </button>
        </div>
        
        <BudgetManager />

        <DailyBriefingCard briefing={dailyBriefing} isLoading={isBriefingLoading} onRefresh={loadBriefing} />

        <PortfolioAnalysisCard pendingPredictions={pendingPredictions} pendingAccumulators={trackedAccumulators.filter(a => !accumulatorResults[a.id])} />

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total P/L" value={`${performanceStats.totalPnl >= 0 ? '+' : ''}${performanceStats.totalPnl.toFixed(2)}`} icon={<BanknotesIcon className="h-6 w-6" />} />
            <StatCard title="Win Rate" value={`${performanceStats.winRate.toFixed(1)}%`} icon={<TrophyIcon className="h-6 w-6" />} />
            <StatCard title="ROI" value={`${performanceStats.roi.toFixed(1)}%`} icon={<ChartBarIcon className="h-6 w-6" />} />
            <StatCard title="Settled/Total Bets" value={`${performanceStats.settledBets} / ${performanceStats.totalBets}`} icon={<ClipboardListIcon className="h-6 w-6" />} />
        </div>
        
        <PerformanceChart 
            favoritePredictions={trackedPredictions}
            favoriteAccumulators={trackedAccumulators}
            predictionResults={predictionResults}
            accumulatorResults={accumulatorResults}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-brand-surface p-4 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><ChartPieIcon className="h-6 w-6" />Performance Breakdown</h2>
                <BreakdownTabs data={breakdownData} />
            </div>
            <div className="bg-brand-surface p-4 rounded-lg shadow-lg">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><StarIcon className="h-6 w-6" />Achievements</h2>
                <Achievements unlockedAchievements={unlockedAchievements} />
            </div>
        </div>

        <div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4 p-4 bg-brand-surface rounded-lg">
                <div className="flex items-center gap-2">
                    <FilterButton label="All" isActive={activeTab === 'all'} onClick={() => setActiveTab('all')} />
                    <FilterButton label="Predictions" isActive={activeTab === 'predictions'} onClick={() => setActiveTab('predictions')} />
                    <FilterButton label="Accumulators" isActive={activeTab === 'accumulators'} onClick={() => setActiveTab('accumulators')} />
                </div>
                <div className="flex items-center gap-2">
                    <FilterButton label="All" isActive={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
                    <FilterButton label="Pending" isActive={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} />
                    <FilterButton label="Settled" isActive={statusFilter === 'settled'} onClick={() => setStatusFilter('settled')} />
                </div>
                 <div className="flex items-center gap-2 text-sm text-brand-text-secondary">
                    <span>Sort by:</span>
                    <select value={sortOrder} onChange={e => setSortOrder(e.target.value as 'date_desc' | 'date_asc')} className="bg-brand-secondary rounded-md p-1.5 focus:ring-2 focus:ring-brand-primary focus:outline-none">
                        <option value="date_desc">Newest First</option>
                        <option value="date_asc">Oldest First</option>
                    </select>
                </div>
            </div>
            
            {(favoritesLoading || isResultsLoading) && <div className="text-center py-8"><Spinner size="lg" /></div>}
            
            {!favoritesLoading && !isResultsLoading && filteredAndSortedItems.length === 0 && (
                <div className="text-center py-16 px-6 bg-brand-surface rounded-lg">
                    <h3 className="text-lg font-medium text-white">No Bets Found</h3>
                    <p className="mt-1 text-sm text-brand-text-secondary">
                        This view is empty. Try changing your filters or <Link to="/football" className="text-brand-primary underline">track some new bets</Link>.
                    </p>
                </div>
            )}
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {filteredAndSortedItems.map(item => {
                    if ('recommendedBet' in item) { // Prediction
                        const result = predictionResults[item.id];
                        return (
                             <MatchPredictionCard
                                key={item.id}
                                match={item}
                                onToggleTrack={(id, type) => {
                                  if (type === 'prediction') {
                                    removePrediction(id);
                                  } else {
                                    removeAccumulator(id);
                                  }
                                }}
                                isTracked={true}
                                isDashboardView={true}
                                virtualStake={item.virtualStake}
                                finalScore={result?.finalScore}
                                betOutcome={result?.betOutcome}
                                isResultLoading={checkingResultId === item.id}
                                pnl={pnlHistory[item.id]}
                                onCheckResult={handleCheckResult}
                            />
                        );
                    } else { // Accumulator
                         const result = accumulatorResults[item.id];
                         return (
                             <AccumulatorCard
                                key={item.id}
                                tip={item}
                                onToggleTrack={removeAccumulator}
                                isTracked={true}
                                isDashboardView={true}
                                virtualStake={item.virtualStake}
                                result={result}
                                isResultLoading={isResultsLoading && !result}
                                pnl={pnlHistory[item.id]}
                            />
                        );
                    }
                })}
            </div>

            <div className="mt-12 text-center">
                <button
                    onClick={() => setClearModalOpen(true)}
                    className="text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 py-2 px-4 rounded-md transition-colors"
                >
                    Clear All Tracked Bets
                </button>
            </div>
        </div>

        <Modal isOpen={isClearModalOpen} onClose={() => setClearModalOpen(false)} title="Confirm Action">
            <p className="text-brand-text-secondary">Are you sure you want to permanently delete all of your tracked bets? This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={() => setClearModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-brand-secondary text-white hover:bg-opacity-80 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={() => {
                        clearAllTrackedBets();
                        setClearModalOpen(false);
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                    Clear All Bets
                </button>
            </div>
        </Modal>
    </div>
  );
};
