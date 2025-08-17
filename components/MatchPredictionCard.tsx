import React from 'react';
import { MatchPrediction, MatchStatus, AccumulatorTip, AccumulatorGame, Sport } from '../types';
import { getMatchStatus } from '../utils/dateUtils';
import { PlusCircleIcon, CheckCircleIcon, TrashIcon, ShieldIcon } from './icons';
import { SportIcon } from './SportIcon';
import RiskIndicator from './RiskIndicator';

interface MatchPredictionCardProps {
  match: MatchPrediction;
  onToggleTrack: (id: string, itemType: 'prediction' | 'accumulator') => void;
  isTracked: boolean;
  isAccumulatorTracked?: boolean;
  isDashboardView?: boolean;
  finalScore?: string | null;
  betOutcome?: 'Won' | 'Lost' | null;
  isResultLoading?: boolean;
  virtualStake?: number;
  accumulatorStake?: number;
  pnl?: number;
  onCheckResult?: (matchId: string) => void;
}

const confidenceColor = (confidence: number) => {
  if (confidence > 80) return 'text-green-500';
  if (confidence > 65) return 'text-yellow-500';
  return 'text-orange-500';
};

const BetBuilderDisplay: React.FC<{
  tip: AccumulatorTip;
  onTrack: (e: React.MouseEvent) => void;
  isTracked: boolean;
  stake?: number;
}> = ({ tip, onTrack, isTracked, stake }) => (
    <div className="mt-4 pt-4 border-t-2 border-dashed border-brand-primary/20">
        <div className="bg-gray-500/10 dark:bg-slate-700/50 p-4 rounded-lg">
            <h4 className="font-bold text-brand-primary flex items-center gap-2 mb-2">
                <ShieldIcon className="h-5 w-5" />
                <span>Bet Builder</span>
            </h4>
             <ul className="list-none pl-0 space-y-2 text-sm mb-3">
                {(tip.games || []).map((game, index) => (
                  <li key={index} className="flex items-center gap-3">
                     <span className="font-semibold text-gray-500 dark:text-slate-400">{index + 1}.</span>
                     <div className="flex-grow flex justify-between items-center text-gray-800 dark:text-slate-100">
                        <span className="font-semibold">{game.prediction}</span>
                        <span className="font-bold">@{(game.odds || 0).toFixed(2)}</span>
                     </div>
                  </li>
                ))}
             </ul>
            <div className="grid grid-cols-2 gap-3 text-center text-xs mb-4">
                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-md">
                    <p className="text-gray-600 dark:text-slate-400">Total Odds</p>
                    <p className="font-bold text-lg text-gray-800 dark:text-slate-100">{(tip.combinedOdds || 0).toFixed(2)}</p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 p-2 rounded-md">
                    <p className="text-gray-600 dark:text-slate-400">Success Prob.</p>
                    <p className="font-bold text-lg text-green-500">{(tip.successProbability || 0).toFixed(0)}%</p>
                </div>
            </div>
            
             {isTracked ? (
                 <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                     <CheckCircleIcon className="h-5 w-5" />
                     <span>Tracked ({(stake || 0).toFixed(2)} u)</span>
                 </button>
             ) : (
                 <button onClick={onTrack} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors shadow-md">
                     <PlusCircleIcon className="h-5 w-5" />
                     <span>Track Bet Builder</span>
                 </button>
             )}
        </div>
    </div>
);


const MatchPredictionCard: React.FC<MatchPredictionCardProps> = ({ 
    match, 
    onToggleTrack,
    isTracked,
    isAccumulatorTracked = false,
    isDashboardView = false,
    finalScore, 
    betOutcome, 
    isResultLoading,
    virtualStake,
    accumulatorStake,
    pnl,
    onCheckResult,
}) => {
  const handleTrackClick = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    onToggleTrack(match.id, 'prediction');
  };
  
  const handleBetBuilderTrackClick = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (match.betBuilder) {
        onToggleTrack(match.betBuilder.id, 'accumulator');
    }
  };

  const { status, text } = getMatchStatus(match.matchDate);

  const statusStyles: Record<MatchStatus, string> = {
    [MatchStatus.Live]: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50 animate-pulse',
    [MatchStatus.Finished]: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600',
    [MatchStatus.Upcoming]: 'bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  };
  
  const TrackButton: React.FC = () => {
    if (isDashboardView) return null;

    if (isTracked) {
        return (
            <button 
                onClick={handleTrackClick} 
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-600 transition-colors"
                aria-label="Untrack this bet"
            >
                <CheckCircleIcon className="h-5 w-5" />
                <span>Tracked ({(virtualStake || 0).toFixed(2)} u)</span>
            </button>
        );
    }

    return (
        <button 
            onClick={handleTrackClick}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors shadow-md"
            aria-label="Track this bet"
        >
            <PlusCircleIcon className="h-5 w-5" />
            <span>Track Bet</span>
        </button>
    );
  };

  const renderPredictionDetails = () => {
    if (status === MatchStatus.Finished) {
        if (isResultLoading) {
            return (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700 flex justify-center items-center h-28">
                    <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-primary"></div>
                        <p className="text-lg font-bold text-gray-500 dark:text-slate-400">Fetching result...</p>
                    </div>
                </div>
            );
        }

        if (betOutcome && pnl !== undefined && virtualStake !== undefined) {
            const outcomeColor = betOutcome === 'Won' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400';
            const resultBgColor = betOutcome === 'Won' ? 'bg-green-500/10 dark:bg-green-500/20' : 'bg-red-500/10 dark:bg-red-500/20';
            const resultBorderColor = betOutcome === 'Won' ? 'border-green-200 dark:border-green-700/50' : 'border-red-200 dark:border-red-700/50';

            return (
                <div className={`mt-6 pt-4 border-t ${resultBorderColor} ${resultBgColor} -mx-6 -mb-6 px-6 pb-6 rounded-b-xl`}>
                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                        <div>
                            <p className="text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Result</p>
                            <p className={`text-xl font-bold ${outcomeColor}`}>{betOutcome}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Final Score</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{finalScore || 'N/A'}</p>
                        </div>
                         <div>
                            <p className="text-gray-500 dark:text-slate-400 text-xs uppercase tracking-wider">Profit/Loss</p>
                            <p className={`text-xl font-bold ${(pnl || 0) >= 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                                {(pnl || 0) >= 0 ? `+${(pnl || 0).toFixed(2)}` : (pnl || 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                    
                    <div className="text-sm space-y-1 pt-3 border-t border-black/10 dark:border-white/10">
                        <p className="font-semibold text-gray-500 dark:text-slate-400 mb-1">Original AI Bet</p>
                        <p><span className="text-gray-500 dark:text-slate-400">Bet: </span><span className="font-semibold text-gray-800 dark:text-slate-100">{match.recommendedBet}</span></p>
                        <p><span className="text-gray-500 dark:text-slate-400">Odds: </span><span className="font-semibold text-gray-800 dark:text-slate-100">@{(match.odds || 0).toFixed(2)}</span></p>
                        <p><span className="text-gray-500 dark:text-slate-400">Stake: </span><span className="font-semibold text-brand-primary">{(virtualStake || 0).toFixed(2)} units</span></p>
                    </div>
                </div>
            );
        }

        if (finalScore && !betOutcome) {
          return (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700 -mx-6 -mb-6 px-6 pb-6 rounded-b-xl bg-gray-500/10 dark:bg-slate-800/20">
                   <div className="grid grid-cols-2 gap-4 mb-4 text-center">
                      <div>
                          <p className="text-gray-600 dark:text-slate-400 text-sm">Result</p>
                          <p className="text-xl font-bold text-yellow-500">Pending</p>
                      </div>
                      <div>
                          <p className="text-gray-600 dark:text-slate-400 text-sm">Final Score</p>
                          <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{finalScore}</p>
                      </div>
                  </div>
                   <p className="text-xs text-center text-gray-500 dark:text-slate-400">AI could not automatically determine bet outcome.</p>
              </div>
          );
        }

        return (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700 flex flex-col justify-center items-center h-28">
                <p className="text-lg font-bold text-gray-500 dark:text-slate-400">Result Not Available</p>
                {onCheckResult && (
                    <button
                        onClick={(e) => { e.preventDefault(); onCheckResult(match.id); }}
                        disabled={isResultLoading}
                        className="mt-2 flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-brand-primary text-white hover:bg-brand-primary-hover disabled:bg-gray-200 dark:disabled:bg-slate-700 disabled:cursor-not-allowed"
                    >
                       Check Result
                    </button>
                )}
            </div>
        );
    }
    
    return (
        <>
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700 space-y-4">
                <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">AI Prediction</p>
                    <p className="text-lg text-gray-800 dark:text-slate-100 font-semibold">{match.aiPrediction}</p>
                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 my-1">
                        <div className="bg-brand-primary h-2 rounded-full" style={{ width: `${(match.aiConfidence || 0)}%` }}></div>
                    </div>
                     <p className="text-xs font-bold text-right text-brand-primary">{(match.aiConfidence || 0).toFixed(1)}% Confidence</p>
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">Learning Prediction</p>
                    <p className="text-lg text-gray-800 dark:text-slate-100 font-semibold">{match.learningPrediction}</p>
                     <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 my-1">
                        <div className="bg-brand-accent-purple h-2 rounded-full" style={{ width: `${(match.learningConfidence || 0)}%` }}></div>
                    </div>
                    <p className="text-xs font-bold text-right text-brand-accent-purple">{(match.learningConfidence || 0).toFixed(1)}% Confidence</p>
                </div>
            </div>
            <div className="!mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                    <div>
                        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400">Recommended Bet</p>
                        <div className="flex items-baseline gap-2">
                            <span className="font-bold text-brand-primary text-xl">{match.recommendedBet}</span>
                            <span className="text-gray-500 dark:text-slate-400">@</span>
                            <span className="text-xl font-bold text-gray-800 dark:text-slate-100">{(match.odds || 0).toFixed(2)}</span>
                        </div>
                    </div>
                    <TrackButton />
                </div>
                {match.aiRationale && <p className="text-sm text-gray-500 dark:text-slate-400 italic mt-2">"{match.aiRationale}"</p>}
            </div>
            {match.betBuilder && match.betBuilder.games && match.betBuilder.games.length > 0 && (
                <BetBuilderDisplay 
                    tip={match.betBuilder}
                    onTrack={handleBetBuilderTrackClick}
                    isTracked={isAccumulatorTracked}
                    stake={accumulatorStake}
                />
            )}
        </>
    );
  };

  return (
    <div
      className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-gray-200/50 dark:border-slate-700/50 h-full flex flex-col"
      aria-label={`View details for ${match.teamA} vs ${match.teamB}`}
    >
        {isDashboardView && (
            <button
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleTrack(match.id, 'prediction'); }}
                className="absolute top-2 right-2 p-1.5 rounded-full text-gray-500 dark:text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors z-10"
                aria-label="Untrack this bet"
            >
                <TrashIcon className="h-5 w-5" />
            </button>
        )}
      
      <div className="flex-grow">
          <div className="flex justify-between items-start mb-2 flex-wrap gap-y-2">
            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 pr-8">{match.teamA} vs {match.teamB}</h3>
            <div className="flex items-center gap-2">
                {match.league && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-600">
                        {match.league}
                    </span>
                )}
                <span className={`px-2 py-1 text-xs font-bold rounded-full ${statusStyles[status]}`}>
                  {status === MatchStatus.Live && '● '}
                  {text}
                </span>
            </div>
          </div>
          
          {match.stadium && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 mt-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 20l-4.95-6.05a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <span>{match.stadium}{match.city ? `, ${match.city}` : ''}</span>
            </div>
          )}

          <div className="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-2 text-sm mt-4 text-gray-800 dark:text-slate-100">
            {match.formA && (
              <>
                <span className="font-semibold text-gray-500 dark:text-slate-400 text-right">Form ({match.teamA}):</span>
                <span className="font-mono text-left">{match.formA}</span>
              </>
            )}
            {match.formB && (
              <>
                <span className="font-semibold text-gray-500 dark:text-slate-400 text-right">Form ({match.teamB}):</span>
                <span className="font-mono text-left">{match.formB}</span>
              </>
            )}
            {match.h2h && (
              <>
                <span className="font-semibold text-gray-500 dark:text-slate-400 text-right">H2H (Last 5):</span>
                <p className="text-left">{match.h2h}</p>
              </>
            )}
            {match.keyStats && (
                <>
                    <span className="font-semibold text-gray-500 dark:text-slate-400 text-right">Key Stat:</span>
                    <p className="text-left">{match.keyStats}</p>
                </>
            )}
          </div>
      </div>
      
      <div className="mt-auto">
        {renderPredictionDetails()}
      </div>
    </div>
  );
};

export default MatchPredictionCard;