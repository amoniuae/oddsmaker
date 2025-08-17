import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../contexts/FavoritesContext';
import { PromoteIcon, TweakIcon, DiscardIcon, RocketIcon, ClipboardListIcon, StarIcon, ArrowTrendingUpIcon, MagicWandIcon, HistoryIcon, BanknotesIcon, ChartBarIcon, TrophyIcon } from '../components/icons';
import Spinner from '../components/Spinner';
import { HydratedStrategy, DailyBriefing, AIRecommendation, Strategy, StrategyVersion } from '../types';
import { fetchDailyBriefing, fetchAIRecommendedStrategy } from '../services/geminiService';
import { StrategyVersionsModal } from '../components/StrategyVersionsModal';
import RiskIndicator from '../components/RiskIndicator';
import { BudgetManager } from '../components/BudgetManager';

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

const AutomatedAnalysisCard: React.FC<{ strategies: HydratedStrategy[] }> = ({ strategies }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [recommendation, setRecommendation] = useState<AIRecommendation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError(null);
        setRecommendation(null);
        try {
            const tempStrategies = strategies.map(s => ({
                id: s.id, name: s.name, parameters: s.deployed_version?.content || {}, wins: s.wins, losses: s.losses, pnl: s.pnl,
            }));
            // @ts-ignore
            const result = await fetchAIRecommendedStrategy(tempStrategies);
            if (result) {
                setRecommendation(result);
            } else {
                setError("The AI could not generate a recommendation at this time. There may not be enough data from past strategies.");
            }
        } catch (err) {
            console.error("Failed to fetch AI recommendation:", err);
            setError("An unexpected error occurred while analyzing your performance.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleApplyAndTweak = () => {
        if (!recommendation) return;
        navigate('/generator/custom', { state: { strategyParameters: recommendation.strategy } });
    };

    const handleDiscard = () => {
        setRecommendation(null);
        setError(null);
    };

    return (
        <div className="bg-brand-surface p-6 rounded-lg shadow-lg border-t-4 border-blue-500">
            <div className="flex items-center gap-3 mb-4">
                <MagicWandIcon className="h-8 w-8 text-blue-400"/>
                <h2 className="text-2xl font-bold text-white">Automatic AI Analysis</h2>
            </div>
            
            {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center h-40">
                    <Spinner size="md" />
                    <p className="mt-4 text-brand-text-secondary">Analyzing your strategy performance...</p>
                </div>
            ) : error ? (
                <div className="text-center py-8 px-4 bg-red-900/20 rounded-md">
                    <p className="text-red-400">{error}</p>
                    <button onClick={handleAnalyze} className="mt-4 text-sm font-semibold bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
                        Try Again
                    </button>
                </div>
            ) : recommendation ? (
                <div>
                    <p className="text-sm text-brand-text-secondary mb-4">Based on your past performance, here is a new strategy the AI recommends:</p>
                    <div className="bg-brand-bg/50 p-4 rounded-md border-l-4 border-blue-400 mb-4">
                        <h4 className="font-semibold text-blue-300">AI Rationale</h4>
                        <p className="text-sm text-blue-200 italic">"{recommendation.rationale}"</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button onClick={handleDiscard} className="text-sm font-semibold bg-brand-secondary text-white py-2 px-4 rounded-md hover:bg-opacity-80 transition-colors">Discard</button>
                        <button onClick={handleAnalyze} className="text-sm font-semibold bg-blue-800 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">Get Another Suggestion</button>
                        <button onClick={handleApplyAndTweak} className="text-sm font-semibold bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-500 transition-colors">Apply & Tweak in Builder</button>
                    </div>
                </div>
            ) : (
                <div>
                    <p className="text-brand-text-secondary mb-4">Let our AI analyze your betting patterns and suggest a new, optimized strategy for you to try in the Tip Builder.</p>
                    <button onClick={handleAnalyze} disabled={strategies.length === 0} className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-500 transition-transform duration-300 transform hover:scale-105 disabled:bg-brand-secondary disabled:cursor-not-allowed disabled:scale-100">
                        <MagicWandIcon className="h-6 w-6" />
                        Analyze My Performance & Suggest New Strategy
                    </button>
                    {strategies.length === 0 && <p className="text-xs text-center mt-2 text-yellow-400">Create and track at least one strategy to enable analysis.</p>}
                </div>
            )}
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

const StrategyCard: React.FC<{ 
    strategy: HydratedStrategy; 
    onUpdate: (id: string, updates: Partial<Strategy>) => void;
    onViewVersions: (strategy: HydratedStrategy) => void;
}> = ({ strategy, onUpdate, onViewVersions }) => {
    const navigate = useNavigate();
    const pnlColor = strategy.pnl > 0 ? 'text-green-400' : strategy.pnl < 0 ? 'text-red-500' : 'text-brand-text-secondary';
    const winRate = (strategy.wins + strategy.losses) > 0 ? (strategy.wins / (strategy.wins + strategy.losses)) * 100 : 0;
    const parameters = strategy.deployed_version?.content || strategy.latest_version?.content;

    const handleTweak = () => {
        if (!parameters) {
            alert("No versions available for this strategy to tweak.");
            return;
        }
        navigate('/generator/custom', { state: { 
            strategyId: strategy.id,
            strategyName: strategy.name,
            strategyParameters: parameters,
        }});
    };

    const handleToggleArchive = () => onUpdate(strategy.id, { is_archived: !strategy.is_archived });
    const handleTogglePromote = () => onUpdate(strategy.id, { is_promoted: !strategy.is_promoted });

    return (
        <div className={`bg-brand-surface p-4 rounded-lg shadow-lg border-l-4 transition-all duration-300 ${strategy.is_promoted ? 'border-yellow-400 shadow-yellow-400/10' : 'border-transparent'} ${strategy.is_archived ? 'opacity-50 hover:opacity-100' : ''}`}>
            <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-white text-lg">{strategy.name}</h3>
                {strategy.is_promoted && <span className="text-xs bg-yellow-400/20 text-yellow-300 font-bold px-2 py-1 rounded-full flex items-center gap-1"><StarIcon className="h-3 w-3"/> Promoted</span>}
            </div>
            <div className="mb-2">
                <span className="text-xs font-mono px-2 py-1 rounded bg-brand-secondary text-brand-text-secondary">
                    Deployed v{strategy.deployed_version?.version_number || 'N/A'} / Latest v{strategy.latest_version?.version_number || 'N/A'}
                </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
                <StatCard title="P/L" value={`${strategy.pnl >= 0 ? '+' : ''}${strategy.pnl.toFixed(2)}`} icon={<BanknotesIcon className="h-6 w-6"/>} />
                <StatCard title="Win Rate" value={`${winRate.toFixed(0)}%`} icon={<TrophyIcon className="h-6 w-6"/>} />
                <StatCard title="Trades" value={`${strategy.wins}/${strategy.losses}`} icon={<ChartBarIcon className="h-6 w-6"/>} />
            </div>

            <div className="text-xs text-brand-text-secondary space-y-1 bg-brand-bg/40 p-3 rounded-md min-h-[80px]">
                {parameters ? (
                    <>
                        <p><strong>Markets:</strong> <span className="text-brand-text">{parameters.aiSelectsMarkets ? 'AI Decides' : parameters.selectedBetTypes.join(', ')}</span></p>
                        <p><strong>Risk:</strong> <span className="text-brand-text">{parameters.successProbability}% Success Target</span></p>
                        {parameters.customNlp && <p className="truncate" title={parameters.customNlp}><strong>Custom:</strong> <span className="text-brand-text">"{parameters.customNlp}"</span></p>}
                    </>
                ) : (
                    <p className="text-brand-text text-center italic">No parameters in latest version.</p>
                )}
            </div>

            <div className="flex justify-end items-center gap-1 sm:gap-2 mt-4 pt-3 border-t border-brand-secondary flex-wrap">
                <button onClick={() => onViewVersions(strategy)} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors" title="View Version History">
                    <HistoryIcon className="h-4 w-4" /> Versions
                </button>
                <button onClick={handleTogglePromote} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors" title={strategy.is_promoted ? "Demote Strategy" : "Promote Strategy"}>
                    <PromoteIcon className="h-4 w-4" />
                </button>
                <button onClick={handleTweak} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors" title="Tweak Strategy in Builder">
                    <TweakIcon className="h-4 w-4" />
                </button>
                <button onClick={handleToggleArchive} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 transition-colors" title={strategy.is_archived ? "Unarchive Strategy" : "Archive Strategy"}>
                    <DiscardIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export const Learning: React.FC = () => {
    const { strategies, isLoading, updateStrategyContainer, performanceStats } = useFavorites();
    const navigate = useNavigate();
    const [showArchived, setShowArchived] = useState(false);
    const [dailyBriefing, setDailyBriefing] = useState<DailyBriefing | null>(null);
    const [isBriefingLoading, setIsBriefingLoading] = useState(true);
    const [selectedStrategyForVersions, setSelectedStrategyForVersions] = useState<HydratedStrategy | null>(null);

    const loadBriefing = useCallback(async () => {
        if (!isLoading && strategies) {
            setIsBriefingLoading(true);
            try {
                const briefing = await fetchDailyBriefing(strategies);
                setDailyBriefing(briefing);
            } catch (error) {
                console.error("Failed to fetch daily briefing:", error);
                setDailyBriefing(null);
            } finally {
                setIsBriefingLoading(false);
            }
        }
    }, [strategies, isLoading]);
    
    useEffect(() => {
        loadBriefing();
    }, [loadBriefing]);

    const activeStrategies = strategies.filter(s => !s.is_archived);
    const archivedStrategies = strategies.filter(s => s.is_archived);
    
    const renderContent = () => {
        if (isLoading) {
            return <div className="py-16"><Spinner size="lg" /></div>;
        }

        const strategiesToDisplay = showArchived ? archivedStrategies : activeStrategies;

        if (strategies.length === 0) {
            return (
                 <div className="text-center py-16 px-6 bg-brand-surface rounded-lg border-2 border-dashed border-brand-secondary">
                    <RocketIcon className="mx-auto h-12 w-12 text-brand-secondary" />
                    <h3 className="mt-4 text-xl font-medium text-white">Your AI Control Panel is Ready</h3>
                    <p className="mt-2 text-brand-text-secondary">
                        Go to the <a href="#/generator/custom" className="text-brand-primary underline hover:text-brand-primary-hover">Tip Builder</a> to create, track, and save your first strategy.
                    </p>
                </div>
            );
        }
        
        if (strategiesToDisplay.length === 0) {
            return (
                 <p className="text-center text-brand-text-secondary py-16">
                    No {showArchived ? 'archived' : 'active'} strategies found.
                </p>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {strategiesToDisplay.sort((a,b) => (b.is_promoted ? 1 : -1) - (a.is_promoted ? 1 : -1) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(strategy => (
                    <StrategyCard key={strategy.id} strategy={strategy} onUpdate={updateStrategyContainer} onViewVersions={setSelectedStrategyForVersions} />
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
                    🧠 AI Control Panel
                </h1>
                <p className="text-lg md:text-xl text-brand-text-secondary max-w-4xl mx-auto">
                    Manage, monitor, and refine your AI strategies. This is the command center for your betting intelligence.
                </p>
            </div>
            
            <BudgetManager />

            <DailyBriefingCard briefing={dailyBriefing} isLoading={isBriefingLoading} onRefresh={loadBriefing} />

            <AutomatedAnalysisCard strategies={strategies} />

            <div className="bg-brand-surface/50 p-6 rounded-lg shadow-lg">
                 <h2 className="text-2xl font-bold text-white mb-4">Performance Overview</h2>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Total Tracked P/L" value={`${performanceStats.totalPnl >= 0 ? '+' : ''}${performanceStats.totalPnl.toFixed(2)}`} icon={<BanknotesIcon className="h-6 w-6"/>} />
                    <StatCard title="Overall Win Rate" value={`${performanceStats.winRate.toFixed(1)}%`} icon={<TrophyIcon className="h-6 w-6" />} />
                    <StatCard title="Settled Bets" value={`${performanceStats.settledBets}`} icon={<ClipboardListIcon className="h-6 w-6"/>} />
                    <StatCard title="Active Strategies" value={activeStrategies.length.toString()} icon={<RocketIcon className="h-6 w-6"/>} />
                 </div>
            </div>

             <div className="bg-brand-surface p-4 rounded-lg">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                         <button
                            onClick={() => setShowArchived(false)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${!showArchived ? 'bg-brand-primary text-white shadow-md' : 'bg-brand-secondary text-brand-text-secondary hover:bg-opacity-80'}`}
                        >
                            Active Strategies ({activeStrategies.length})
                        </button>
                        <button
                            onClick={() => setShowArchived(true)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${showArchived ? 'bg-brand-primary text-white shadow-md' : 'bg-brand-secondary text-brand-text-secondary hover:bg-opacity-80'}`}
                        >
                            Archived ({archivedStrategies.length})
                        </button>
                    </div>
                     <button
                        onClick={() => navigate('/generator/custom')}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 font-semibold rounded-md transition-colors bg-green-600 text-white hover:bg-green-500 shadow-lg shadow-green-600/20"
                    >
                        <RocketIcon className="h-5 w-5" />
                        Create New Strategy
                    </button>
                </div>
            </div>

            {renderContent()}

            {selectedStrategyForVersions && (
                <StrategyVersionsModal
                    isOpen={!!selectedStrategyForVersions}
                    onClose={() => setSelectedStrategyForVersions(null)}
                    strategy={selectedStrategyForVersions}
                />
            )}
        </div>
    );
};