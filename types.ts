export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
  
export enum Sport {
  Football = "Football",
  Basketball = "Basketball",
  Tennis = "Tennis",
  TableTennis = "Table Tennis",
  IceHockey = "Ice Hockey",
  Volleyball = "Volleyball",
  Handball = "Handball",
  AmericanFootball = "American Football",
}

export enum MatchStatus {
  Upcoming = "Upcoming",
  Live = "Live",
  Finished = "Finished",
}

export interface MatchPrediction {
  id: string;
  teamA: string;
  teamB: string;
  matchDate: string;
  sport: Sport;
  formA?: string;
  formB?: string;
  h2h?: string;
  keyStats?: string;
  stadium?: string;
  city?: string;
  aiPrediction: string;
  aiConfidence: number;
  learningPrediction: string;
  learningConfidence: number;
  aiRationale?: string;
  recommendedBet: string;
  odds: number;
  league?: string;
  betBuilder?: AccumulatorTip; // New field for single-game multi-leg bets
}

export interface FavoritePrediction extends MatchPrediction {
  virtualStake: number;
}

export interface AccumulatorGame {
  teamA: string;
  teamB: string;
  prediction: string;
  sport: Sport;
  matchDate: string;
  odds: number;
  rationale?: string;
  confidence?: number;
}

export interface AccumulatorTip {
  id: string;
  name: string;
  successProbability: number;
  combinedOdds: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  rationale?: string;
  games: AccumulatorGame[];
  strategy_id?: string;
  strategy_version_id?: string;
}

export interface FavoriteAccumulator extends AccumulatorTip {
  virtualStake: number;
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface PredictionsWithSources {
  predictions: MatchPrediction[];
  sources: GroundingChunk[];
}

export interface AccumulatorTipsWithSources {
  tips: AccumulatorTip[];
  sources: GroundingChunk[];
}

export interface FootballPageData {
  predictions?: MatchPrediction[];
  accumulators?: AccumulatorTip[];
}

export interface PredictionResult {
    finalScore: string | null;
    betOutcome: 'Won' | 'Lost' | null;
}

export interface IndividualLegResult {
    teamA: string;
    teamB: string;
    outcome: 'Won' | 'Lost' | null;
}

export interface AccumulatorResult {
    id: string;
    finalOutcome: 'Won' | 'Lost' | null;
    legResults: IndividualLegResult[];
}

// --- AI Learning & Strategy Types (NEW Versioned System) ---

// Represents the strategy container in the `strategies` table
export interface Strategy {
  id: string; // uuid
  created_at: string; // timestamp
  user_id: string;
  name: string;
  description: string | null;
  pnl: number;
  wins: number;
  losses: number;
  is_archived: boolean;
  is_promoted: boolean;
}

// Represents an immutable version in the `strategy_versions` table
export interface StrategyVersion {
  id: string; // version uuid
  strategy_id: string; // container uuid
  version_number: number;
  author: string | null;
  changelog: string | null;
  content: any; // The JSONB parameters for the builder
  deployed: boolean;
  created_at: string;
}

// Combined type used in the application state for convenience
export interface HydratedStrategy extends Strategy {
  latest_version: StrategyVersion | null;
  deployed_version: StrategyVersion | null;
}


// --- Other AI-related types ---
export interface SavedStrategy {
    name: string;
    state: any;
}

export interface AIRecommendation {
    strategy: {
        selectedBetTypes: string[];
        customNlp: string;
        numGames: number;
        successProbability: number;
        timeFrame: string;
        aiSelectsMarkets: boolean;
    };
    rationale: string;
}

export interface DailyBriefing {
    marketOpportunity: string;
    performanceHighlight: string;
    strategySuggestion: string;
    confidenceScore: number;
    riskLevel: 'Low' | 'Medium' | 'High';
    learningInsights: string[];
    marketTrends: string[];
}

export interface PortfolioAnalysis {
  portfolioConfidence: number;
  portfolioRiskLevel: 'Low' | 'Medium' | 'High';
  linchpinBet: {
    description: string;
    rationale: string;
  };
  hiddenRisk: string;
  hedgeSuggestion: {
    bet: string;
    rationale: string;
  };
}

export interface AccumulatorStrategySets {
  homeFortress: AccumulatorTip | null;
  goalRush: AccumulatorTip | null;
  underdogHunt: AccumulatorTip | null;
  cautiousPlay: AccumulatorTip | null;
}