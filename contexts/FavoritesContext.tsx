import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { getSessionUserId } from '../utils/session';
import { FavoritePrediction, FavoriteAccumulator, MatchPrediction, AccumulatorTip, Strategy, StrategyVersion, HydratedStrategy, PredictionResult, AccumulatorResult, MatchStatus, Json } from '../types';
import { getMatchStatus, safeNewDate } from '../utils/dateUtils';
import { fetchScoresForPredictions, fetchResultsForAccumulators } from '../services/geminiService';
import { Database } from '../database.types';

interface FavoritesContextType {
  trackedPredictions: FavoritePrediction[];
  trackedAccumulators: FavoriteAccumulator[];
  strategies: HydratedStrategy[];
  isLoading: boolean;
  error: string | null;
  addPrediction: (prediction: MatchPrediction, virtualStake: number) => Promise<void>;
  removePrediction: (predictionId: string) => Promise<void>;
  addAccumulator: (accumulator: AccumulatorTip, virtualStake: number, strategy_id?: string, strategy_version_id?: string) => Promise<void>;
  removeAccumulator: (accumulatorId: string) => Promise<void>;
  saveNewStrategy: (name: string, description: string | undefined, content: any, changelog: string | undefined) => Promise<HydratedStrategy | null>;
  saveNewVersion: (strategyId: string, content: any, changelog: string | undefined) => Promise<StrategyVersion | null>;
  rollbackStrategy: (strategyId: string, versionId: string) => Promise<void>;
  fetchStrategyVersions: (strategyId: string) => Promise<StrategyVersion[]>;
  updateStrategyContainer: (strategyId: string, updates: Partial<Strategy>) => Promise<void>;
  updateStrategyOutcome: (strategyId: string, outcome: 'Won' | 'Lost', pnl: number) => Promise<void>;
  clearAllTrackedBets: () => Promise<void>;
  clearError: () => void;

  // New props for budget and performance
  initialBudget: number;
  setInitialBudget: (amount: number) => void;
  totalPnL: number;
  totalStaked: number;
  availableBalance: number;
  performanceStats: {
    totalPnl: number;
    winRate: number;
    roi: number;
    settledBets: number;
    totalBets: number;
  };
  predictionResults: Record<string, PredictionResult>;
  accumulatorResults: Record<string, AccumulatorResult>;
  isResultsLoading: boolean;
  pnlHistory: Record<string, number>;

  // New props for pending/settled items
  pendingPredictions: FavoritePrediction[];
  settledPredictions: FavoritePrediction[];
  pendingAccumulators: FavoriteAccumulator[];
  settledAccumulators: FavoriteAccumulator[];
}


const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const THIRTY_DAYS_AGO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const BUDGET_KEY = 'ai-predictor-budget';

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trackedPredictions, setTrackedPredictions] = useState<FavoritePrediction[]>([]);
  const [trackedAccumulators, setTrackedAccumulators] = useState<FavoriteAccumulator[]>([]);
  const [strategies, setStrategies] = useState<HydratedStrategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = getSessionUserId();

  // New State for Budget & Results
  const [initialBudget, setBudget] = useState<number>(() => {
    const savedBudget = localStorage.getItem(BUDGET_KEY);
    return savedBudget ? parseFloat(savedBudget) : 1000;
  });
  const [predictionResults, setPredictionResults] = useState<Record<string, PredictionResult>>({});
  const [accumulatorResults, setAccumulatorResults] = useState<Record<string, AccumulatorResult>>({});
  const [isResultsLoading, setIsResultsLoading] = useState(false);
  const fetchingResultsRef = useRef(false);

  const setInitialBudget = (amount: number) => {
    localStorage.setItem(BUDGET_KEY, amount.toString());
    setBudget(amount);
  };
  
  const clearError = () => setError(null);

  const handleSupabaseError = (error: any, context: string) => {
    console.error(`Supabase error while ${context}:`, JSON.stringify(error, null, 2));
    const errorMessage = (error.message || '').toLowerCase();
    
    if (errorMessage.includes('api key')) {
      setError('Authentication with the database failed. Please ensure the Supabase API key in `config.ts` is correct.');
    } else if (
      error.code === 'PGRST205' ||
      (errorMessage.includes('relation') && errorMessage.includes('does not exist'))
    ) {
      setError('DATABASE_TABLES_MISSING');
    }
    else {
      setError(`A database error occurred while ${context}. Please check your connection and try again.`);
    }
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch all base data concurrently
      const [predictionsRes, accumulatorsRes, strategiesRes] = await Promise.all([
        supabase.from('tracked_predictions').select('prediction_id, prediction_data, virtual_stake').eq('user_id', userId).gte('created_at', THIRTY_DAYS_AGO),
        supabase.from('tracked_accumulators').select('accumulator_id, accumulator_data, virtual_stake').eq('user_id', userId).gte('created_at', THIRTY_DAYS_AGO),
        supabase.from('strategies').select('*').eq('user_id', userId)
      ]);

      if (predictionsRes.error) return handleSupabaseError(predictionsRes.error, 'loading tracked predictions');
      if (accumulatorsRes.error) return handleSupabaseError(accumulatorsRes.error, 'loading tracked accumulators');
      if (strategiesRes.error) return handleSupabaseError(strategiesRes.error, 'loading strategies');

      // 2. Process predictions and accumulators
      const preds = (predictionsRes.data || []).map((item: any) => ({ ...(item.prediction_data as MatchPrediction), virtualStake: item.virtual_stake }));
      const accs = (accumulatorsRes.data || []).map((item: any) => ({ ...(item.accumulator_data as AccumulatorTip), virtualStake: item.virtual_stake }));
      setTrackedPredictions(preds.sort((a,b) => safeNewDate(a.matchDate).getTime() - safeNewDate(b.matchDate).getTime()));
      setTrackedAccumulators(accs.sort((a,b) => {
          const gamesA = a.games || [];
          const gamesB = b.games || [];
          const lastGameDateA = gamesA.reduce((latest, g) => Math.max(latest, safeNewDate(g.matchDate).getTime()), 0);
          const lastGameDateB = gamesB.reduce((latest, g) => Math.max(latest, safeNewDate(g.matchDate).getTime()), 0);
          return lastGameDateA - lastGameDateB;
      }));

      // 3. Hydrate strategies with their versions
      const strategyContainers = (strategiesRes.data || []) as Strategy[];
      if (strategyContainers.length > 0) {
        const strategyIds = strategyContainers.map(s => s.id);
        const { data: versions, error: versionsError } = await supabase.from('strategy_versions').select('*').in('strategy_id', strategyIds);
        if(versionsError) return handleSupabaseError(versionsError, 'loading strategy versions');

        const hydrated = strategyContainers.map(container => {
            const relevantVersions = (versions || []).filter(v => v.strategy_id === container.id).sort((a, b) => b.version_number - a.version_number);
            return {
                ...container,
                latest_version: relevantVersions[0] || null,
                deployed_version: relevantVersions.find(v => v.deployed) || null,
            };
        });
        setStrategies(hydrated.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } else {
        setStrategies([]);
      }

    } catch (err: any) {
      handleSupabaseError(err, 'connecting to the database');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Centralized Result Fetching Logic
  const isAccumulatorFinished = useCallback((tip: FavoriteAccumulator): boolean => {
    if (!tip.games || tip.games.length === 0) return false;
    const lastGameDateString = tip.games.reduce((latest, game) => {
        return safeNewDate(game.matchDate) > safeNewDate(latest) ? game.matchDate : latest;
    }, tip.games[0]?.matchDate || '');
    return getMatchStatus(lastGameDateString).status === MatchStatus.Finished;
  }, []);
  
  useEffect(() => {
    if (isLoading || error || fetchingResultsRef.current) return;

    const fetchAllResults = async () => {
        fetchingResultsRef.current = true;
        setIsResultsLoading(true);

        const predictionsToFetch = trackedPredictions.filter(p => 
            getMatchStatus(p.matchDate).status === MatchStatus.Finished && 
            !predictionResults[p.id]
        );
        const accumulatorsToFetch = trackedAccumulators.filter(acc => 
            isAccumulatorFinished(acc) && 
            !accumulatorResults[acc.id]
        );

        if (predictionsToFetch.length > 0 || accumulatorsToFetch.length > 0) {
            const [predResults, accResults] = await Promise.all([
                predictionsToFetch.length > 0 ? fetchScoresForPredictions(predictionsToFetch) : Promise.resolve({}),
                accumulatorsToFetch.length > 0 ? fetchResultsForAccumulators(accumulatorsToFetch) : Promise.resolve({}),
            ]);
            
            setPredictionResults(prev => ({ ...prev, ...predResults }));
            setAccumulatorResults(prev => ({ ...prev, ...accResults }));
        }

        setIsResultsLoading(false);
        fetchingResultsRef.current = false;
    };

    fetchAllResults();
  }, [trackedPredictions, trackedAccumulators, isLoading, error, predictionResults, accumulatorResults, isAccumulatorFinished]);

  // Memoized performance calculations
  const { pendingPredictions, settledPredictions, pendingAccumulators, settledAccumulators } = useMemo(() => {
      const settledPreds: FavoritePrediction[] = [];
      const pendingPreds: FavoritePrediction[] = [];
      trackedPredictions.forEach(p => {
          if (predictionResults[p.id]?.betOutcome) settledPreds.push(p);
          else pendingPreds.push(p);
      });

      const settledAccs: FavoriteAccumulator[] = [];
      const pendingAccs: FavoriteAccumulator[] = [];
      trackedAccumulators.forEach(a => {
          if (accumulatorResults[a.id]?.finalOutcome) settledAccs.push(a);
          else pendingAccs.push(a);
      });
      return { 
          pendingPredictions: pendingPreds, 
          settledPredictions: settledPreds, 
          pendingAccumulators: pendingAccs, 
          settledAccumulators: settledAccs 
      };
  }, [trackedPredictions, trackedAccumulators, predictionResults, accumulatorResults]);
  
  const pnlHistory = useMemo(() => {
    const history: Record<string, number> = {};
    settledPredictions.forEach(p => {
        const result = predictionResults[p.id];
        history[p.id] = result.betOutcome === 'Won' 
            ? p.virtualStake * (p.odds || 0) - p.virtualStake 
            : -p.virtualStake;
    });
    settledAccumulators.forEach(acc => {
        const result = accumulatorResults[acc.id];
        history[acc.id] = result.finalOutcome === 'Won' 
            ? acc.virtualStake * (acc.combinedOdds || 0) - acc.virtualStake
            : -acc.virtualStake;
    });
    return history;
  }, [settledPredictions, settledAccumulators, predictionResults, accumulatorResults]);

  const totalPnL = useMemo(() => Object.values(pnlHistory).reduce((sum, pnl) => sum + pnl, 0), [pnlHistory]);
  
  const totalStaked = useMemo(() => 
    [...pendingPredictions, ...pendingAccumulators].reduce((sum, item) => sum + item.virtualStake, 0),
    [pendingPredictions, pendingAccumulators]
  );
  
  const availableBalance = useMemo(() => initialBudget + totalPnL - totalStaked, [initialBudget, totalPnL, totalStaked]);

  const performanceStats = useMemo(() => {
    const wonCount = settledPredictions.filter(p => predictionResults[p.id].betOutcome === 'Won').length +
                     settledAccumulators.filter(acc => accumulatorResults[acc.id].finalOutcome === 'Won').length;
    
    const settledCount = settledPredictions.length + settledAccumulators.length;
    const totalStakeOnSettled = [...settledPredictions, ...settledAccumulators].reduce((sum, item) => sum + item.virtualStake, 0);

    return {
        totalPnl: totalPnL,
        winRate: settledCount > 0 ? (wonCount / settledCount) * 100 : 0,
        roi: totalStakeOnSettled > 0 ? (totalPnL / totalStakeOnSettled) * 100 : 0,
        settledBets: settledCount,
        totalBets: trackedPredictions.length + trackedAccumulators.length,
    };
  }, [totalPnL, settledPredictions, settledAccumulators, predictionResults, accumulatorResults, trackedPredictions, trackedAccumulators]);

  const addPrediction = async (prediction: MatchPrediction, virtualStake: number) => {
    clearError();
    const newFavorite: FavoritePrediction = { ...prediction, virtualStake };
    const payload: Database['public']['Tables']['tracked_predictions']['Insert'] = {
      user_id: userId,
      prediction_id: prediction.id,
      prediction_data: prediction as unknown as Json,
      virtual_stake: virtualStake,
    };
    const { error } = await supabase.from('tracked_predictions').upsert([payload], { onConflict: 'user_id,prediction_id' });

    if (error) { handleSupabaseError(error, 'tracking the prediction'); } 
    else { setTrackedPredictions(prev => [...prev.filter(p => p.id !== prediction.id), newFavorite].sort((a,b) => safeNewDate(a.matchDate).getTime() - safeNewDate(b.matchDate).getTime())); }
  };

  const removePrediction = async (predictionId: string) => {
    clearError();
    const { error } = await supabase.from('tracked_predictions').delete().match({ user_id: userId, prediction_id: predictionId });
    if (error) { handleSupabaseError(error, 'untracking the prediction'); } 
    else { setTrackedPredictions(prev => prev.filter(p => p.id !== predictionId)); }
  };
  
  const addAccumulator = async (accumulator: AccumulatorTip, virtualStake: number, strategy_id?: string, strategy_version_id?: string) => {
    clearError();
    const accumulator_data = { ...accumulator, strategy_id, strategy_version_id };
    const newFavorite: FavoriteAccumulator = { ...accumulator_data, virtualStake };
    
    const payload: Database['public']['Tables']['tracked_accumulators']['Insert'] = {
      user_id: userId,
      accumulator_id: accumulator.id,
      accumulator_data: accumulator_data as unknown as Json,
      virtual_stake: virtualStake,
    };
    
    const { error } = await supabase.from('tracked_accumulators').upsert([payload], { onConflict: 'user_id,accumulator_id' });

    if (error) { handleSupabaseError(error, 'tracking the accumulator'); } 
    else { setTrackedAccumulators(prev => [...prev.filter(a => a.id !== accumulator.id), newFavorite].sort((a,b) => {
            const gamesA = a.games || []; const gamesB = b.games || [];
            const lastA = gamesA.reduce((l, g) => Math.max(l, safeNewDate(g.matchDate).getTime()), 0);
            const lastB = gamesB.reduce((l, g) => Math.max(l, safeNewDate(g.matchDate).getTime()), 0);
            return lastA - lastB;
        }));
    }
  };

  const removeAccumulator = async (accumulatorId: string) => {
      clearError();
      const { error } = await supabase.from('tracked_accumulators').delete().match({ user_id: userId, accumulator_id: accumulatorId });
      if (error) { handleSupabaseError(error, 'untracking the accumulator'); }
      else { setTrackedAccumulators(prev => prev.filter(a => a.id !== accumulatorId)); }
  };

  const saveNewStrategy = async (name: string, description: string | undefined, content: any, changelog: string | undefined): Promise<HydratedStrategy | null> => {
    clearError();
    const containerPayload: Database['public']['Tables']['strategies']['Insert'] = { name, description: description || null, user_id: userId };
    const { data: container, error: containerError } = await supabase.from('strategies').insert([containerPayload]).select().single();
    if (containerError) { handleSupabaseError(containerError, 'creating strategy container'); return null; }

    const versionPayload: Database['public']['Tables']['strategy_versions']['Insert'] = {
        strategy_id: container.id, content: content as unknown as Json, changelog: changelog || null, author: 'system', deployed: true
    };
    const { data: version, error: versionError } = await supabase.from('strategy_versions').insert([versionPayload]).select().single();
    if (versionError) { handleSupabaseError(versionError, 'creating first strategy version'); return null; }

    const newHydratedStrategy: HydratedStrategy = { ...container, latest_version: version, deployed_version: version };
    setStrategies(prev => [newHydratedStrategy, ...prev]);
    return newHydratedStrategy;
  };
  
  const saveNewVersion = async (strategyId: string, content: any, changelog: string | undefined): Promise<StrategyVersion | null> => {
    clearError();
    const payload: Database['public']['Tables']['strategy_versions']['Insert'] = {
        strategy_id: strategyId, content: content as unknown as Json, changelog: changelog || null, author: 'user', deployed: false
    };
    const { data: version, error: versionError } = await supabase.from('strategy_versions').insert([payload]).select().single();

    if (versionError) { handleSupabaseError(versionError, 'saving new strategy version'); return null; }
    
    await fetchData();
    return version;
  };

  const rollbackStrategy = async (strategyId: string, versionId: string) => {
    clearError();
    const undeployPayload: Database['public']['Tables']['strategy_versions']['Update'] = { deployed: false };
    const { error: errorUndeploy } = await supabase.from('strategy_versions').update(undeployPayload).eq('strategy_id', strategyId);
    if (errorUndeploy) return handleSupabaseError(errorUndeploy, 'rolling back (step 1)');

    const deployPayload: Database['public']['Tables']['strategy_versions']['Update'] = { deployed: true };
    const { error: errorDeploy } = await supabase.from('strategy_versions').update(deployPayload).eq('id', versionId);
    if (errorDeploy) return handleSupabaseError(errorDeploy, 'rolling back (step 2)');

    await fetchData();
  };

  const fetchStrategyVersions = async (strategyId: string): Promise<StrategyVersion[]> => {
      const { data, error } = await supabase.from('strategy_versions').select('*').eq('strategy_id', strategyId).order('version_number', { ascending: false });
      if(error) { handleSupabaseError(error, 'fetching version history'); return []; }
      return data || [];
  };

  const updateStrategyContainer = async (strategyId: string, updates: Partial<Strategy>) => {
      clearError();
      const payload: Database['public']['Tables']['strategies']['Update'] = updates;
      const { data, error } = await supabase.from('strategies').update(payload).match({ id: strategyId, user_id: userId }).select().single();
      if (error) { handleSupabaseError(error, 'updating strategy container'); } 
      else if (data) { setStrategies(prev => prev.map(s => s.id === strategyId ? { ...s, ...data } : s)); }
  };
  
  const updateStrategyOutcome = async (strategyId: string, outcome: 'Won' | 'Lost', pnl: number) => {
    clearError();
    const strategy = strategies.find(s => s.id === strategyId);
    if (!strategy) return;
    const updates: Partial<Strategy> = {
      pnl: strategy.pnl + pnl,
      wins: strategy.wins + (outcome === 'Won' ? 1 : 0),
      losses: strategy.losses + (outcome === 'Lost' ? 1 : 0),
    };
    await updateStrategyContainer(strategyId, updates);
  };

  const clearAllTrackedBets = async () => {
      clearError();
      const [predError, accError] = await Promise.all([
        supabase.from('tracked_predictions').delete().eq('user_id', userId),
        supabase.from('tracked_accumulators').delete().eq('user_id', userId)
      ]);
      if (predError.error) return handleSupabaseError(predError.error, 'clearing all predictions');
      if (accError.error) return handleSupabaseError(accError.error, 'clearing all accumulators');
      setTrackedPredictions([]);
      setTrackedAccumulators([]);
  };

  const value = {
    trackedPredictions, trackedAccumulators, strategies, isLoading, error, addPrediction, removePrediction, addAccumulator, removeAccumulator, saveNewStrategy, saveNewVersion, rollbackStrategy, fetchStrategyVersions, updateStrategyContainer, updateStrategyOutcome, clearAllTrackedBets, clearError,
    // New props
    initialBudget, setInitialBudget, totalPnL, totalStaked, availableBalance, performanceStats, predictionResults, accumulatorResults, isResultsLoading: isResultsLoading || isLoading, pnlHistory, pendingPredictions, settledPredictions, pendingAccumulators, settledAccumulators,
  };

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
};

export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};
