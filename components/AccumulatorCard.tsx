
import React from 'react';
import { AccumulatorTip, MatchStatus, AccumulatorResult, AccumulatorGame } from '../types';
import RiskIndicator from './RiskIndicator';
import { SportIcon } from './SportIcon';
import { getMatchStatus } from '../utils/dateUtils';
import { PlusCircleIcon, CheckCircleIcon, TrashIcon, TrophyIcon, BanknotesIcon, ChartBarIcon } from './icons';

interface AccumulatorCardProps {
  tip: AccumulatorTip;
  onToggleTrack: (id: string) => void;
  isTracked: boolean;
  isDashboardView?: boolean;
  result?: AccumulatorResult | null;
  isResultLoading?: boolean;
  virtualStake?: number;
  pnl?: number;
}

const confidenceColor = (confidence: number) => {
  if (confidence > 80) return 'text-green-500';
  if (confidence > 65) return 'text-yellow-500';
  return 'text-orange-500';
};


const AccumulatorCard: React.FC<AccumulatorCardProps> = ({ 
    tip, 
    onToggleTrack,
    isTracked,
    isDashboardView = false,
    result, 
    isResultLoading, 
    virtualStake, 
    pnl 
}) => {
  
  const handleTrackClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggleTrack(tip.id);
  };

  const statusStyles: Record<MatchStatus, string> = {
    [MatchStatus.Live]: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50 animate-pulse',
    [MatchStatus.Finished]: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600',
    [MatchStatus.Upcoming]: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  };

  const legResultOutcomeStyles = {
    Won: 'text-green-600 dark:text-green-400 font-bold',
    Lost: 'text-red-600 dark:text-red-400 font-bold',
    null: 'text-gray-500 dark:text-slate-400 italic',
  };

  const getLegResult = (game: AccumulatorGame) => {
    return result?.legResults.find(r => r.teamA === game.teamA && r.teamB === game.teamB) || null;
  };
  
  const TrackButton: React.FC = () => {
    if (isDashboardView) return null;

    if (isTracked) {
        return (
            <button 
                onClick={handleTrackClick} 
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600 transition-colors w-full"
                aria-label="Untrack this accumulator"
            >
                <CheckCircleIcon className="h-5 w-5" />
                <span>Tracked ({(virtualStake || 0).toFixed(2)} u)</span>
            </button>
        );
    }

    return (
        <button 
            onClick={handleTrackClick}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors w-full shadow-md"
            aria-label="Track this accumulator"
        >
            <PlusCircleIcon className="h-5 w-5" />
            <span>Track Accumulator</span>
        </button>
    );
  };

  const renderCardContent = () => {
    if (isResultLoading) {
      return (
        <div className="flex-grow flex justify-center items-center h-48">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-primary"></div>
            <p className="text-lg font-bold text-gray-500 dark:text-slate-400">Fetching results...</p>
          </div>
        </div>
      );
    }

    if (result && result.finalOutcome && pnl !== undefined && virtualStake !== undefined) {
       const outcomeColor = result.finalOutcome === 'Won' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';
       const outcomeBadgeBg = result.finalOutcome === 'Won' ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-red-500/10 dark:bg-red-500/20';

      return (
        <div className={`-mx-6 -mb-6 mt-4 px-6 pb-6 rounded-b-xl ${outcomeBadgeBg}`}>
          <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-gray-200 dark:border-slate-700 mb-4">
              <div>
                <p className="text-gray-500 dark:text-slate-400 text-sm">Final Result</p>
                <p className={`text-xl font-bold ${outcomeColor}`}>{result.finalOutcome}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-slate-400 text-sm">Stake</p>
                <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{(virtualStake || 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-slate-400 text-sm">Profit/Loss</p>
                 <p className={`text-xl font-bold ${(pnl || 0) >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                    {(pnl || 0) >= 0 ? `+${(pnl || 0).toFixed(2)}` : (pnl || 0).toFixed(2)}
                </p>
              </div>
          </div>
           <ul className="list-none pl-0 space-y-3 text-sm">
              {(tip.games || []).map((game, index) => {
                const legResult = getLegResult(game);
                const outcomeText = legResult?.outcome || 'N/A';
                const outcomeStyle = legResultOutcomeStyles[legResult?.outcome || 'null'];
                return (
                  <li key={index} className="flex items-start gap-3 p-2 bg-white/50 dark:bg-slate-800/50 rounded-md">
                     <span className="font-semibold text-gray-500 dark:text-slate-400 pt-0.5">{index + 1}.</span>
                     <div className="flex-grow">
                       <div className="flex items-center gap-2 text-gray-800 dark:text-slate-100">
                         <SportIcon sport={game.sport} className="h-5 w-5 text-brand-primary flex-shrink-0" />
                         <span className="font-semibold">{game.teamA} vs {game.teamB}</span>
                       </div>
                       <div className="pl-7 mt-1 flex justify-between items-center">
                         <p className="font-bold text-brand-primary">{game.prediction} @{(game.odds || 0).toFixed(2)}</p>
                         <span className={`text-xs font-bold ${outcomeStyle}`}>{outcomeText}</span>
                       </div>
                     </div>
                  </li>
                );
              })}
           </ul>
        </div>
      );
    }

    // Default view for upcoming/live
    return (
      <>
        {tip.rationale && (
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 italic border-l-2 border-brand-primary/50 pl-3">
            "{tip.rationale}"
          </p>
        )}
        {tip.games && tip.games.length >= 8 && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs rounded-md flex items-center gap-2 border border-yellow-200 dark:border-yellow-800/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.001-1.742 3.001H4.42c-1.532 0-2.492-1.667-1.742-3.001l5.58-9.92zM10 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="font-bold">High-Risk Warning:</span> Accumulators with {tip.games.length} legs have an extremely low probability of winning.
          </div>
        )}
        <div className="flex-grow space-y-2 mb-4">
          <p className="text-gray-500 dark:text-slate-400 text-sm">Games included:</p>
          <ul className="list-none pl-0 space-y-4 text-sm">
            {(tip.games || []).map((game, index) => {
              const { status, text } = getMatchStatus(game.matchDate);
              const gameConfidenceColor = game.confidence ? confidenceColor(game.confidence) : 'text-gray-500 dark:text-slate-400';
              return (
                <li key={index} className="flex items-start gap-3">
                  <span className="font-semibold text-gray-500 dark:text-slate-400 pt-0.5">{index + 1}.</span>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 text-gray-800 dark:text-slate-100">
                      <SportIcon sport={game.sport} className="h-5 w-5 text-brand-primary flex-shrink-0" />
                      <span className="font-semibold">{game.teamA} vs {game.teamB}</span>
                    </div>
                    <div className="pl-7 mt-1 flex justify-between items-center flex-wrap gap-2">
                        <p className="font-bold text-brand-primary">{game.prediction} <span className="text-sm font-normal">@{(game.odds || 0).toFixed(2)}</span></p>
                        <div className="flex items-center gap-3">
                            {game.confidence && (
                                <span className={`text-xs font-bold ${gameConfidenceColor}`}>
                                   {(game.confidence || 0).toFixed(0)}% Conf.
                                </span>
                            )}
                            {game.matchDate && (
                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${statusStyles[status]}`}>
                                {status === MatchStatus.Live && '● '}
                                {text}
                                </span>
                            )}
                        </div>
                    </div>
                     {game.rationale && (
                      <p className="text-xs text-gray-500 dark:text-slate-400 italic mt-1 pl-7 border-l-2 border-gray-200 dark:border-slate-700 ml-1 px-2">
                        {game.rationale}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-auto pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <TrophyIcon className="h-4 w-4 text-yellow-500" />
                        <p className="text-xs text-gray-500 dark:text-slate-400">Success Prob.</p>
                    </div>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{(tip.successProbability || 0).toFixed(1)}%</p>
                </div>
                <div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <BanknotesIcon className="h-4 w-4 text-green-500" />
                        <p className="text-xs text-gray-500 dark:text-slate-400">Combined Odds</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">{(tip.combinedOdds || 0).toFixed(2)}</p>
                </div>
                <div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <ChartBarIcon className="h-4 w-4 text-red-500" />
                        <p className="text-xs text-gray-500 dark:text-slate-400">Risk Level</p>
                    </div>
                    <div className="mt-1 flex justify-center">
                      <RiskIndicator level={tip.riskLevel} />
                    </div>
                </div>
            </div>
            <TrackButton />
        </div>
      </>
    );
  };

  return (
    <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm rounded-xl shadow-lg p-6 flex flex-col h-full border border-gray-200/50 dark:border-slate-700/50 relative">
       {isDashboardView ? (
         <button
            onClick={handleTrackClick}
            className="absolute top-2 right-2 p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors z-10"
            aria-label="Untrack this accumulator"
         >
           <TrashIcon className="h-5 w-5" />
         </button>
       ) : null}


      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 pr-8">{tip.name}</h3>
      </div>
      
      {renderCardContent()}
    </div>
  );
};

export default AccumulatorCard;