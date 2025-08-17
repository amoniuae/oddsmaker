import { GoogleGenAI } from "@google/genai";
import { Sport, MatchPrediction, AccumulatorTip, PredictionsWithSources, AccumulatorTipsWithSources, GroundingChunk, FootballPageData, AccumulatorResult, AccumulatorGame, PredictionResult, HydratedStrategy, AIRecommendation, DailyBriefing, AccumulatorStrategySets, FavoritePrediction, FavoriteAccumulator, PortfolioAnalysis } from '../types';
import { getCachedData, setCachedData } from '../utils/caching';
import { getTodayAndTomorrowGH, getNext7DaysForPromptGH, getThisWeekRangeForPromptGH } from '../utils/dateUtils';

// Lazy-initialized instance to avoid setup errors on module load.
let aiInstance: GoogleGenAI | null = null;

/**
 * Initializes and returns the GoogleGenAI client instance.
 * Throws an error if the API key is not configured.
 */
const getAiClient = (): GoogleGenAI => {
    if (aiInstance) {
        return aiInstance;
    }

    const apiKey = import.meta.env?.VITE_API_KEY;
    
    // The App.tsx component should prevent this from being called without a key,
    // but this serves as a final safeguard.
    if (!apiKey || apiKey === 'PASTE_YOUR_GEMINI_API_KEY_HERE') {
        throw new Error("An API Key must be set when running in a browser. Please configure it in your .env.local file.");
    }
    
    aiInstance = new GoogleGenAI({ apiKey });
    return aiInstance;
};

const JSON_SYSTEM_INSTRUCTION = "You are a sports data API. Your only output format is raw, valid JSON. You do not provide any explanations, logs, or conversational text. Your entire response must start and end with the appropriate JSON delimiters (e.g., '{' and '}' for an object). Your entire response must be ONLY the JSON, with no other text before or after.";

const SCORE_CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const BASE_PREDICTION_PROMPT = `
1.  **DUAL PREDICTION MODEL:** For each match, provide two distinct predictions: "aiPrediction" (data-driven) and "learningPrediction" (form-focused). Both need confidence scores. The "recommendedBet" should be the single best bet.
2.  **BET BUILDER GENERATION (Optional):** If a compelling, multi-leg, single-game accumulator (a "Bet Builder") can be created for a match, generate one. This should be a 2-4 leg bet with correlated outcomes (e.g., Team A wins, Over 2.5 Goals, Team A top scorer to score). The "betBuilder" field should be an AccumulatorTip object. If no good Bet Builder opportunity exists, this field **MUST** be \`null\`.
3.  **DEEP SOURCING & VERIFICATION:** Use Google Search extensively. Your response MUST be grounded in multiple, reliable, and recent sources. Verify every game detail (existence, schedule, odds) against several sources to ensure maximum accuracy. The quantity and quality of grounding sources are critical.
4.  **NO HALLUCINATION:** Strictly forbidden from inventing game data.
5.  **DATA TYPES:** All numeric values MUST be numbers, not strings.
6.  **EMPTY STATE:** If no verifiable matches are found for a query, return the appropriate empty JSON structure (e.g., \`{ "predictions": [], "accumulators": [] }\` or \`[]\`).
`;

const PREDICTION_JSON_SCHEMA = `
{
  "id": "a-unique-v4-uuid",
  "teamA": "string",
  "teamB": "string",
  "league": "string",
  "stadium": "string",
  "city": "string",
  "matchDate": "ISO 8601 string",
  "sport": "Football",
  "formA": "e.g., 'WWLDW'",
  "formB": "e.g., 'LLDLW'",
  "h2h": "A descriptive sentence.",
  "keyStats": "A detailed, insightful key statistic.",
  "aiPrediction": "Specific prediction, e.g., 'Team A to win with a clean sheet.'",
  "aiConfidence": 93.0,
  "learningPrediction": "Specific secondary prediction, e.g., 'Team A to win and under 3.5 goals.'",
  "learningConfidence": 90.0,
  "aiRationale": "Detailed rationale for the recommended bet.",
  "recommendedBet": "string",
  "odds": 2.30,
  "betBuilder": { ...AccumulatorTip object... } or null
}
`;

export const parseJsonResponse = <T,>(jsonString: any): T | null => {
  if (typeof jsonString === 'object' && jsonString !== null) {
    // The response seems to be an already parsed JSON object.
    return jsonString as T;
  }

  if (typeof jsonString !== 'string') {
    console.error("Failed to parse JSON: AI response was not a string or a valid object.", { response: jsonString });
    return null;
  }

  let textToParse = jsonString.trim();
  const lowerCaseText = textToParse.toLowerCase();

  // Early exit for simple 'null' response.
  if (lowerCaseText === 'null') {
      return null;
  }
  
  // Check for signs of a conversational response instead of JSON.
  const isLikelyNotJson = !lowerCaseText.startsWith('{') && !lowerCaseText.startsWith('[');
  
  const conversationalKeywords = [
      // Failure/inability to find information
      'i am sorry', 'i cannot', 'unable to find', 'could not find',
      'no verifiable matches', 'no football matches', 'data is not available',
      'not possible to fulfill', 'no odds were provided',
      'challenging', 'absence of readily available', 'not possible to fulfill the request',
      'due to the nature', 'unable to provide', 'not possible to provide', 'as an ai',
      'appropriate response is \`null\`', 'the response will be \`null\`',
      // Verbose success messages (not in JSON format)
      'based on the available information',
      'ai prediction:',
      'ai rationale:'
  ];
  
  const hasConversationalKeywords = conversationalKeywords.some(keyword => lowerCaseText.includes(keyword));

  // Check if the string concludes with `null`, ignoring trailing punctuation or backticks.
  const endsWithNull = /`?null`?\.?\s*$/.test(lowerCaseText);

  // If it doesn't look like JSON and has conversational keywords, or is a long text that ends with 'null',
  // treat it as a non-JSON response and return null to avoid parsing errors.
  if (isLikelyNotJson && (hasConversationalKeywords || (textToParse.length > 50 && endsWithNull))) {
      console.warn("AI returned a conversational response instead of JSON. Interpreting as null.", { response: jsonString });
      return null;
  }

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
  const match = textToParse.match(fenceRegex);

  if (match && match[1]) {
    textToParse = match[1].trim();
  } else {
    // If no fence, try to find the start of a JSON object or array.
    const jsonStartIndex = textToParse.indexOf('{');
    const arrayStartIndex = textToParse.indexOf('[');

    let startIndex = -1;

    if (jsonStartIndex > -1 && arrayStartIndex > -1) {
      startIndex = Math.min(jsonStartIndex, arrayStartIndex);
    } else if (jsonStartIndex > -1) {
      startIndex = jsonStartIndex;
    } else {
      startIndex = arrayStartIndex;
    }

    if (startIndex !== -1) {
        textToParse = textToParse.substring(startIndex);
    } else {
      // If we still can't find a JSON start, and it wasn't caught by the conversational check, then it's a true parsing failure.
      console.error("Failed to find JSON start in the response.");
      console.error("Original string:", jsonString);
      return null;
    }
  }

  // Sanitize common annotation/formatting issues.
  const annotationRegex = /tapped from search result \[\d+(,\s*\d+)*\]/g;
  textToParse = textToParse.replace(annotationRegex, '');
  
  const rogueWordRegex = /(?<=")\s+\w+\s*(?=[,}\]])/g;
  textToParse = textToParse.replace(rogueWordRegex, '');

  const malformedDateRegex = /(\d{2}:\d{2}:\d{2}):\d{2}(Z)/g;
  textToParse = textToParse.replace(malformedDateRegex, '$1$2');

  const mergedObjectRegex = /(Z")\s*\w+\s*(\w+)(?=:)/g;
  textToParse = textToParse.replace(mergedObjectRegex, '$1}, {"$2"');


  try {
    // Final check for the literal 'null' after sanitization
    if (textToParse.trim().toLowerCase() === 'null') {
        return null;
    }
    return JSON.parse(textToParse) as T;
  } catch (error) {
    console.error("Failed to parse JSON response:", error);
    console.error("Original string was:", jsonString);
    console.error("Attempted to parse:", textToParse);
    return null;
  }
};

export const fetchDailyBriefing = async (pastStrategies: HydratedStrategy[]): Promise<DailyBriefing | null> => {
    const ai = getAiClient();
    const promptData = pastStrategies.map(s => ({
        name: s.name,
        params: s.deployed_version?.content || s.latest_version?.content || {},
        wins: s.wins,
        losses: s.losses,
        pnl: s.pnl
    }));

    const prompt = `
    Act as a senior betting analyst preparing a daily briefing for a user. Analyze their past strategies and provide concise, actionable insights.

    **CONTEXT: PAST STRATEGIES**
    Here is a summary of the user's previously created and tracked strategies, including their performance:
    ${JSON.stringify(promptData, null, 2)}

    **YOUR TASK:**
    Generate a daily briefing with multiple key sections, providing deep, actionable insights.

    **OUTPUT REQUIREMENTS (CRITICAL):**
    You MUST respond with a single, valid JSON object with the following keys: "marketOpportunity", "performanceHighlight", "strategySuggestion", "confidenceScore", "riskLevel", "learningInsights", and "marketTrends".

    1.  **"marketOpportunity" (string):** Identify a single, compelling market or type of bet for today's games that looks promising. Keep it brief (1-2 sentences).
    2.  **"performanceHighlight" (string):** Look at the user's settled strategies. Find one positive takeaway. If there are no settled strategies or all have lost, provide a general encouragement. (1-2 sentences).
    3.  **"strategySuggestion" (string):** Based on their history, suggest one simple adjustment or a new strategy to try in the Tip Builder. (1-2 sentences).
    4.  **"confidenceScore" (number):** A confidence score from 0-100 for your "marketOpportunity".
    5.  **"riskLevel" ('Low' | 'Medium' | 'High'):** The overall risk associated with the "strategySuggestion".
    6.  **"learningInsights" (string[]):** An array of 2-3 brief, insightful observations based on the user's performance patterns (e.g., "High-risk accumulators are consistently underperforming," "Bets on 'Home Wins' in La Liga have a 75% success rate.").
    7.  **"marketTrends" (string[]):** An array of 2-3 current, observable betting market trends (e.g., "Defensive teams are overperforming in Serie A," "The 'Over 2.5 Goals' market is showing reduced value this week.").

    **DO NOT:**
    - Do not include any text outside of the JSON object.
    - If there is no data, provide optimistic but generic advice for each section.

    Now, generate the JSON response.
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: "You are an expert sports betting analyst API. Your ONLY output is raw, valid JSON.",
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
        },
    });
    
    return parseJsonResponse<DailyBriefing>(response.text);
};


export const fetchAIRecommendedStrategy = async (pastStrategies: HydratedStrategy[]): Promise<AIRecommendation | null> => {
    const ai = getAiClient();
    const promptData = pastStrategies.map(s => ({
        name: s.name,
        params: s.deployed_version?.content || s.latest_version?.content || {},
        wins: s.wins,
        losses: s.losses,
        pnl: s.pnl
    }));

    const prompt = `
    You are an expert betting analyst. Analyze the user's past strategies and recommend a new, optimized strategy.
    
    **USER'S PAST STRATEGIES:**
    ${JSON.stringify(promptData, null, 2)}

    **YOUR TASK:**
    Based on the performance of past strategies, generate a JSON object for a new, optimized strategy.
    - Analyze profitable and unprofitable bet types, risk levels, and number of games.
    - Identify patterns.
    - If the user has a history of success with AI market selection, recommend it.
    - Generate a concise rationale (2-3 sentences) explaining why you are recommending these specific parameters.
    
    **OUTPUT JSON FORMAT (MUST MATCH EXACTLY):**
    {
      "strategy": {
        "selectedBetTypes": ["string"],
        "customNlp": "string",
        "numGames": "number",
        "successProbability": "number",
        "timeFrame": "string",
        "aiSelectsMarkets": "boolean"
      },
      "rationale": "string"
    }

    Return ONLY the raw JSON object.
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: "You are an expert sports betting analyst API. Your ONLY output is raw, valid JSON.",
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
        },
    });
    
    return parseJsonResponse<AIRecommendation>(response.text);
};

export const fetchPortfolioAnalysis = async (pendingPredictions: FavoritePrediction[], pendingAccumulators: FavoriteAccumulator[]): Promise<PortfolioAnalysis | null> => {
    const ai = getAiClient();
    // Simplified representation for the prompt to save tokens
    const simplePredictions = pendingPredictions.map(p => ({ 
        bet: p.recommendedBet, 
        odds: p.odds, 
        stake: p.virtualStake, 
        teams: `${p.teamA} vs ${p.teamB}` 
    }));
    const simpleAccumulators = pendingAccumulators.map(a => ({ 
        name: a.name, 
        odds: a.combinedOdds, 
        stake: a.virtualStake, 
        games: (a.games || []).length, 
        risk: a.riskLevel 
    }));

    const prompt = `
    Act as a professional betting portfolio risk analyst. Your task is to analyze a user's collection of pending (unsettled) bets and provide a concise, structured risk assessment.

    **CONTEXT: USER'S PENDING BETS**
    - Single Predictions: ${JSON.stringify(simplePredictions, null, 2)}
    - Accumulators: ${JSON.stringify(simpleAccumulators, null, 2)}

    **YOUR TASK:**
    Generate a single, valid JSON object that assesses the user's entire portfolio.

    **OUTPUT REQUIREMENTS (CRITICAL):**
    You MUST respond with a single, valid JSON object with five keys: "portfolioConfidence", "portfolioRiskLevel", "linchpinBet", "hiddenRisk", and "hedgeSuggestion".

    1.  **"portfolioConfidence" (number):** Provide an overall confidence score (0-100) for the entire portfolio successfully winning. Consider the mix of singles, accumulators, risks, and stakes.
    2.  **"portfolioRiskLevel" ('Low' | 'Medium' | 'High'):** Assess the overall risk level of the entire pending portfolio.
    3.  **"linchpinBet" (object):** Identify the single most important bet in the portfolio. This could be the one with the highest stake, the riskiest accumulator, or the bet that seems most likely to fail.
        - "description" (string): A short description of the bet (e.g., "The 'Goal Rush' accumulator").
        - "rationale" (string): A brief explanation for why it's the linchpin (e.g., "This accumulator has the highest potential payout but also carries significant risk due to the number of legs.").
    4.  **"hiddenRisk" (string):** Identify a subtle or correlated risk across the portfolio that the user might have missed. If no specific risk is found, provide general advice. (1-3 sentences). Example: "Several of your bets rely on favored teams playing away from home, which can be less predictable than home fixtures." or "Your portfolio is well-diversified across different markets, which is a solid strategy."
    5.  **"hedgeSuggestion" (object):** Suggest one specific, actionable bet that could act as a hedge to mitigate potential losses. This should be a real, searchable bet.
        - "bet" (string): The specific bet to place (e.g., "Real Madrid Double Chance (Win or Draw)").
        - "rationale" (string): Why this bet works as a hedge (e.g., "If your high-risk bet on the underdog fails and Real Madrid dominates as expected, this safer bet could recover some of your stake.").
        - If no sensible hedge is possible, the "bet" can be "No hedge recommended" with an appropriate rationale.

    **DO NOT:**
    - Do not include any text outside of the JSON object.
    - Base your analysis ONLY on the data provided. Do not use external search for this task.

    Now, generate the JSON response.
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: "You are an expert sports betting analyst API. Your ONLY output is raw, valid JSON.",
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 0 },
        },
    });
    
    return parseJsonResponse<PortfolioAnalysis>(response.text);
};


export const fetchAllLeaguesData = async (forceRefresh = false): Promise<{ data: FootballPageData | null, sources: GroundingChunk[] }> => {
  const ai = getAiClient();
  const cacheKey = `leagueData-All`;
  if (!forceRefresh) {
    const cachedData = getCachedData<FootballPageData>(cacheKey);
    if (cachedData) return { data: cachedData, sources: [] };
  }

  const allLeagueNames = [
    // International Club Competitions
    'UEFA Champions League', 'UEFA Europa League', 'UEFA Conference League', 'CONMEBOL Libertadores', 'CONMEBOL Sudamericana', 'AFC Champions League', 'FIFA Club World Cup', 'Leagues Cup 2025', 'UEFA Super Cup',
    // Major Domestic Leagues
    'English Premier League', 'La Liga (Spain)', 'Serie A (Italy)', 'Bundesliga (Germany)', 'Ligue 1 (France)', 'Major League Soccer (MLS)', 'Brasileiro Série A', 'Argentine Primera División', 'Eredivisie (Netherlands)', 'Primeira Liga (Portugal)', 'Saudi Pro League',
    // Other
    'Club Friendly Games',
  ].join('", "');

  const prompt = `Generate a JSON object with 'predictions' and 'accumulators' for upcoming football matches from any of the following leagues: **"${allLeagueNames}"**. Look for games in the near future (next 14 days).

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
${BASE_PREDICTION_PROMPT}
7.  **LEAGUE SCOPE:** Only include games from the provided list.
8.  **ACCUMULATOR LOGIC:** The 'prediction' for each game in the 'accumulators' array must be the 'recommendedBet' from the main prediction object.

**JSON OUTPUT REQUIREMENTS:**
- Final output: \`{ "predictions": [...], "accumulators": [...] }\`.
- **'predictions' Property:** An array of football prediction objects, each conforming to: ${PREDICTION_JSON_SCHEMA}
- **'accumulators' Property:** An array of 1-3 distinct accumulator tip objects created ONLY from the games in your 'predictions' response.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: JSON_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsedData = parseJsonResponse<FootballPageData>(response.text);
  const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
  if(parsedData) {
    setCachedData(cacheKey, parsedData);
  }
  return { data: parsedData, sources };
};

export const fetchLeagueData = async (leagueName: string, forceRefresh = false): Promise<{ data: FootballPageData | null, sources: GroundingChunk[] }> => {
  const ai = getAiClient();
  const cacheKey = `leagueData-${leagueName.replace(/[\s/]/g, '-')}`;
  if (!forceRefresh) {
    const cachedData = getCachedData<FootballPageData>(cacheKey);
    if (cachedData) return { data: cachedData, sources: [] };
  }

  const prompt = `Generate a JSON object with 'predictions' and 'accumulators' for upcoming football matches in the **"${leagueName}"**. Look for games in the near future (next 14 days).

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
${BASE_PREDICTION_PROMPT}
7.  **LEAGUE FOCUS:** Only include games from **"${leagueName}"**.
8.  **ACCUMULATOR LOGIC:** The 'prediction' for each game in 'accumulators' must be the 'recommendedBet' from a prediction.

**JSON OUTPUT REQUIREMENTS:**
- Final output: \`{ "predictions": [...], "accumulators": [...] }\`.
- **'predictions' Property:** An array of football match prediction objects from "${leagueName}", conforming to: ${PREDICTION_JSON_SCHEMA}
- **'accumulators' Property:** An array of 1-3 accumulator tip objects created ONLY from the games in your 'predictions' response.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: JSON_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsedData = parseJsonResponse<FootballPageData>(response.text);
  const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
  if(parsedData) {
    setCachedData(cacheKey, parsedData);
  }
  return { data: parsedData, sources };
};

export const fetchJCGamesPageData = async (forceRefresh = false): Promise<{ data: FootballPageData | null, sources: GroundingChunk[] }> => {
  const ai = getAiClient();
  const cacheKey = 'jcGamesData';
  if (!forceRefresh) {
    const cachedData = getCachedData<FootballPageData>(cacheKey);
    if (cachedData) return { data: cachedData, sources: [] };
  }

  const { startOfWeek, endOfWeek } = getThisWeekRangeForPromptGH();
  const prompt = `Generate a JSON object with 'predictions' and 'accumulators' for upcoming football matches from the **J1 League, J2 League, J3 League (Japan), and the Chinese Super League (CSL)**. Focus on games between **${startOfWeek} and ${endOfWeek}**.

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
${BASE_PREDICTION_PROMPT}
7.  **LEAGUE SCOPE:** Only include games from the specified Japanese and Chinese leagues.
8.  **ACCUMULATOR LOGIC:** The 'prediction' for each game in 'accumulators' must be the 'recommendedBet' from a prediction.

**JSON OUTPUT REQUIREMENTS:**
- Final output: \`{ "predictions": [...], "accumulators": [...] }\`.
- **'predictions' Property:** An array of football match prediction objects, each conforming to: ${PREDICTION_JSON_SCHEMA}
- **'accumulators' Property:** An array of 1-3 accumulator tip objects created ONLY from the games in 'predictions'.
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: JSON_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsedData = parseJsonResponse<FootballPageData>(response.text);
  const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
  if (parsedData) {
    setCachedData(cacheKey, parsedData);
  }
  return { data: parsedData, sources };
};

export const fetchBetOfTheDay = async (forceRefresh = false): Promise<{ prediction: MatchPrediction | null, sources: GroundingChunk[] }> => {
  const ai = getAiClient();
  const cacheKey = 'betOfTheDay';
  if (!forceRefresh) {
    const cachedData = getCachedData<{ prediction: MatchPrediction | null, sources: GroundingChunk[] }>(cacheKey);
    if (cachedData) return cachedData;
  }

  const { todayString } = getTodayAndTomorrowGH();
  
  const prompt = `Analyze upcoming football matches for **today, ${todayString}**, and identify the **single best betting opportunity**. This should be the 'recommendedBet' you have the absolute highest confidence in.

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
${BASE_PREDICTION_PROMPT}
7.  **SINGLE HIGHEST-CONFIDENCE BET ONLY:** Your entire JSON output must be a single prediction object, not an array.
8.  **EMPTY STATE:** If you cannot find a single, high-confidence bet that meets all criteria, your entire response **MUST** be the JSON literal \`null\`.

**JSON OUTPUT REQUIREMENTS:**
- The final output MUST be a single JSON object conforming to: ${PREDICTION_JSON_SCHEMA}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: JSON_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsedData = parseJsonResponse<MatchPrediction>(response.text);
  const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
  const result = { prediction: parsedData, sources };

  if (parsedData) {
    setCachedData(cacheKey, result);
  }
  return result;
};

export const fetchSportPredictions = async (sport: Sport, forceRefresh = false): Promise<PredictionsWithSources> => {
    const ai = getAiClient();
    const cacheKey = `weekly${sport.replace(/\s+/g, '')}Games`;
    if (!forceRefresh) {
        const cachedData = getCachedData<PredictionsWithSources>(cacheKey);
        if (cachedData) return cachedData;
    }
    
    const { todayString, tomorrowString } = getTodayAndTomorrowGH();
    
    const prompt = `Generate a comprehensive JSON array of upcoming ${sport} match predictions for today (${todayString}) and tomorrow (${tomorrowString}).

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
${BASE_PREDICTION_PROMPT}
7.  **SPORT FOCUS:** "sport" property MUST be "${sport}".
8.  **BROAD SEARCH:** Find as many games as possible for the specified sport.

**JSON OUTPUT REQUIREMENTS:**
- The final output MUST be a valid JSON array of prediction objects.
- Each object in the array MUST strictly conform to this structure: ${PREDICTION_JSON_SCHEMA.replace('"Football"', `"${sport}"`)}
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: JSON_SYSTEM_INSTRUCTION,
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 0 },
        },
    });

    const parsedData = parseJsonResponse<MatchPrediction[]>(response.text);
    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
    const result = { predictions: parsedData || [], sources };
    
    if (parsedData) {
        setCachedData(cacheKey, result);
    }
    return result;
};

export const fetchWeeklyFootballGames = async (forceRefresh = false): Promise<{ predictions: MatchPrediction[], sources: GroundingChunk[] }> => {
    const ai = getAiClient();
    const cacheKey = 'weeklyFootballGames';
    if (!forceRefresh) {
        const cachedData = getCachedData<{ predictions: MatchPrediction[], sources: GroundingChunk[] }>(cacheKey);
        if (cachedData) return cachedData;
    }

    const { startOfWeek, endOfWeek } = getThisWeekRangeForPromptGH();
    const allLeagueNames = [
        // International Club Competitions
        'UEFA Champions League', 'UEFA Europa League', 'UEFA Conference League', 'CONMEBOL Libertadores', 'CONMEBOL Sudamericana', 'AFC Champions League', 'FIFA Club World Cup', 'Leagues Cup 2025', 'UEFA Super Cup',
        // Major Domestic Leagues
        'English Premier League', 'La Liga (Spain)', 'Serie A (Italy)', 'Bundesliga (Germany)', 'Ligue 1 (France)', 'Major League Soccer (MLS)', 'Brasileiro Série A', 'Argentine Primera División', 'Eredivisie (Netherlands)', 'Primeira Liga (Portugal)', 'Saudi Pro League',
        // Other
        'Club Friendly Games',
    ].join('", "');

    const prompt = `Generate a comprehensive JSON array of upcoming football match predictions for this week (from **${startOfWeek} to ${endOfWeek}**). The games should be from any of the following major leagues: **"${allLeagueNames}"**.

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
${BASE_PREDICTION_PROMPT}
7.  **BROAD SEARCH & VERIFICATION:** Be as comprehensive as possible.
8.  **ACCURATE DATES:** The 'matchDate' must fall within this week.

**JSON OUTPUT REQUIREMENTS:**
- The final output MUST be a valid JSON array of prediction objects.
- Each object MUST conform to this structure: ${PREDICTION_JSON_SCHEMA}
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: JSON_SYSTEM_INSTRUCTION,
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 0 },
        },
    });

    const parsedData = parseJsonResponse<MatchPrediction[]>(response.text);
    const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
    const result = { predictions: parsedData || [], sources };
    
    if (parsedData) {
        setCachedData(cacheKey, result);
    }
    return result;
};


export const fetchFootballPageData = async (forceRefresh = false): Promise<{ data: FootballPageData | null, sources: GroundingChunk[] }> => {
  const ai = getAiClient();
  const cacheKey = 'footballPageData';
  if (!forceRefresh) {
    const cachedData = getCachedData<FootballPageData>(cacheKey);
    if (cachedData) return { data: cachedData, sources: [] };
  }

  const { todayString, tomorrowString } = getTodayAndTomorrowGH();
  const prompt = `Generate a JSON object with 'predictions' and 'accumulators' for upcoming football matches for today (${todayString}) and tomorrow (${tomorrowString}).

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
${BASE_PREDICTION_PROMPT}
7.  **ACCUMULATOR LOGIC:** The 'prediction' for each game in 'accumulators' must be the 'recommendedBet' from a prediction.

**JSON OUTPUT REQUIREMENTS:**
- Final output: \`{ "predictions": [...], "accumulators": [...] }\`.
- **'predictions' Property:** An array of up to 10 football match prediction objects, each conforming to: ${PREDICTION_JSON_SCHEMA}
- **'accumulators' Property:** An array of up to 3 distinct accumulator tip objects (e.g., Low, Medium, High risk) created using games from the 'predictions' array. **Only return accumulators for which you can find suitable games. Do not return empty accumulator shells.**
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: JSON_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsedData = parseJsonResponse<FootballPageData>(response.text);
  const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
  if(parsedData) {
    setCachedData(cacheKey, parsedData);
  }
  return { data: parsedData, sources };
};

export const fetchAccumulatorStrategySets = async (forceRefresh = false): Promise<{ data: AccumulatorStrategySets | null; sources: GroundingChunk[] }> => {
  const ai = getAiClient();
  const cacheKey = 'accumulatorStrategySets';
  if (!forceRefresh) {
    const cachedData = getCachedData<AccumulatorStrategySets>(cacheKey);
    if (cachedData) return { data: cachedData, sources: [] };
  }

  const { todayString } = getTodayAndTomorrowGH();
  const prompt = `
SYSTEM: You are a factual, strict JSON generator for football accumulator tips. You MUST NOT invent any fixtures or odds. Use live web search (Google) + at least two independent odds sources (bookmakers + odds aggregator) to verify every match and odds. If you cannot find verified matches that fit a strategy, return null for that strategy.

TASK: Generate one JSON object (no surrounding text) matching the schema below. Use only matches scheduled for TODAY, ${todayString}. The four strategies MUST be present as keys: "homeFortress", "goalRush", "underdogHunt", "cautiousPlay". For each strategy, either return a valid AccumulatorTip object or null.

STRATEGY DEFINITIONS:
-   **"homeFortress"**: A 3-4 leg accumulator. Focus on strong HOME teams with a high probability of winning. Look for teams with excellent home records. Risk should be Low-Medium. Name it "Home Fortress".
-   **"goalRush"**: A 3-4 leg accumulator. Focus on matches with a high likelihood of goals. Use markets like "Over 2.5 Goals" or "BTTS (Yes)". Risk is Medium. Name it "Goal Rush".
-   **"underdogHunt"**: A 2-3 leg accumulator. High-risk, high-reward. Identify AWAY teams or DRAWs that are undervalued by the market but have a fighting chance. Use higher odds bets. Name it "Underdog Hunt".
-   **"cautiousPlay"**: A 4-5 leg accumulator. Low risk. Use very safe bets like "Double Chance (1X or X2)" for strong favorites, or "Over 0.5 Goals" in games expected to have at least one goal. The goal is high probability, even with low combined odds. Name it "Cautious Play".

ACCUMULATORTIP SCHEMA (must match exactly):
{
  "id": "<v4-uuid>",
  "name": "<Strategy Name>",
  "successProbability": <number 0-100>,
  "combinedOdds": <decimal odds product>,
  "riskLevel": "Low"|"Medium"|"High",
  "rationale": "<text explaining why each selected game matches the strategy>",
  "games": [
    {
      "teamA":"Home Team",
      "teamB":"Away Team",
      "prediction":"Market string (e.g., 'Home Win (1)', 'Over 2.5 Goals', 'Double Chance (1X)')",
      "sport":"Football",
      "matchDate":"ISO 8601 UTC",
      "odds": <decimal number>,
      "confidence": <0-100 integer>
    }, ...
  ]
}

RULES (CRITICAL):
1. Use ONLY matches on TODAY, ${todayString}.
2. Cross-check each match and odds with at least two reliable sources (e.g., official league site, ESPN, BBC Sport, Flashscore, OddsPortal, TheOddsAPI, Pinnacle, Bet365) and include only the normalized decimal odds that you verified.
3. Per-leg "confidence" must be a numeric 0–100. Base it on recency of sources, home/away form, odds margin, injuries (if verifiable), or betting market liquidity.
4. If insufficient verified matches exist for a strategy, set that strategy to null.
5. Return a single raw JSON object with only the 4 keys (no extra commentary).
6. Avoid invented teams/odds/dates.

OUTPUT: The exact JSON object only (no explanation). End.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: JSON_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }],
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parsedData = parseJsonResponse<AccumulatorStrategySets>(response.text);
  const sources = (response.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[]) || [];
  if (parsedData) {
    setCachedData(cacheKey, parsedData);
  }
  return { data: parsedData, sources };
};

export const generateCustomAccumulator = async (
    betTypesInstruction: string,
    customNlp: string,
    timeFrame: string,
    numGames: number,
    successProbability: number,
    riskLevel: 'Low' | 'Medium' | 'High'
): Promise<AccumulatorTip | null> => {
    const ai = getAiClient();
    const prompt = `
      Generate a single, custom football accumulator tip based on the user's detailed strategy.
      **1. USER'S STRATEGY:**
      - Bet Market Selection: ${betTypesInstruction}
      - User's Custom Instructions: "${customNlp || 'Focus on the other parameters.'}"
      - Desired Timeframe for matches: Within the next ${timeFrame}
      **2. CORE PARAMETERS:**
      - Number of Games: Exactly ${numGames}
      - Target Overall Success Probability: Approximately ${successProbability}%. This is a crucial target.
      **CRITICAL INSTRUCTIONS (NON-NEGOTIABLE):**
      1.  **FLEXIBILITY IS KEY:** Your primary goal is to return a valid ${numGames}-leg accumulator that meets the **Target Overall Success Probability**. If you cannot find enough games that perfectly match every single criterion, you **MUST RELAX OTHER CONSTRAINTS** to find real, upcoming games that allow you to build an accumulator with the requested probability.
      2.  **REAL-TIME VERIFICATION:** Use Google Search to find real, UPCOMING games and their odds.
      3.  **PER-LEG RATIONALE & CONFIDENCE:** For EACH game, you MUST provide a 'rationale' explaining WHY it was chosen for this specific strategy. You MUST also include a numeric 'confidence' score (from 0 to 100).
      4.  **NO HALLUCINATION:** Do not invent games, stats, or odds.
      5.  **JSON ONLY:** Your entire response MUST be the raw JSON object.
      6.  **EMPTY STATE:** Only if it is absolutely impossible to find any relevant matches even after relaxing constraints, return a JSON object with an empty "games" array and a "rationale" explaining why.
      **JSON OUTPUT REQUIREMENTS:** { "id": "a-unique-v4-uuid", "name": "Custom AI-Generated Tip", "successProbability": "number (close to target)", "combinedOdds": "number", "riskLevel": "${riskLevel}", "rationale": "A 1-2 sentence explanation of the overall accumulator strategy and how the chosen games fit.", "games": [ { "teamA": "string", "teamB": "string", "prediction": "The bet for this game", "sport": "Football", "matchDate": "ISO 8601 string", "odds": "number", "confidence": "number", "rationale": "Brief explanation for choosing THIS game based on the user's strategy." } ] }
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: "You are an expert sports betting analyst API. Your ONLY output is raw, valid JSON.",
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 0 },
        },
    });
    
    return parseJsonResponse<AccumulatorTip>(response.text);
};


export const fetchScoresForPredictions = async (predictions: MatchPrediction[]): Promise<Record<string, PredictionResult>> => {
    const ai = getAiClient();
    const BATCH_SIZE = 20; // Process 20 predictions per API call
    const DELAY_MS = 1000;   // 1 second delay between batches

    const cacheKey = 'scoresCache';
    const cachedScores = getCachedData<Record<string, PredictionResult>>(cacheKey, SCORE_CACHE_DURATION_MS) || {};

    const predictionsToFetch = predictions.filter(p => cachedScores[p.id] === undefined);

    if (predictionsToFetch.length === 0) {
        const relevantScores: Record<string, PredictionResult> = {};
        for(const p of predictions) {
            if(cachedScores[p.id] !== undefined) {
                relevantScores[p.id] = cachedScores[p.id];
            }
        }
        return relevantScores;
    }

    const allNewScores: Record<string, PredictionResult> = {};

    for (let i = 0; i < predictionsToFetch.length; i += BATCH_SIZE) {
        const batch = predictionsToFetch.slice(i, i + BATCH_SIZE);
        
        const matchesToQuery = batch.map(p => ({
            id: p.id,
            teamA: p.teamA,
            teamB: p.teamB,
            matchDate: p.matchDate,
            recommendedBet: p.recommendedBet,
        }));

        const prompt = `For the following list of completed sports matches, use Google Search to find the final score for each one AND determine if the recommended bet was won or lost.

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
1.  **EXTENSIVE REAL-TIME VERIFICATION IS MANDATORY:** You **MUST** use Google Search exhaustively. Cross-reference multiple reliable sports media outlets to find the official final scores.
2.  **DETERMINE OUTCOME:** Compare the final score to the 'recommendedBet' to determine the outcome.
    - If the bet was correct, 'betOutcome' is "Won".
    - If the bet was incorrect, 'betOutcome' is "Lost".
    - For bets like "Over 2.5 Goals", calculate if the total goals meet the criteria.
3.  **STRICT JSON OUTPUT:** Your entire response must be a valid JSON array. Each object must conform to: \`{ "id": "string", "finalScore": "string", "betOutcome": "Won" | "Lost" }\`.
4.  **SCORE FORMAT:** The 'finalScore' should be a string like "2 - 1", "105 - 98", etc.
5.  **HANDLE MISSING DATA:** If you cannot find a definitive final score OR cannot determine the outcome for a match ID, you **MUST** return that object with 'finalScore' and 'betOutcome' values of \`null\`. Do not omit it.
6.  **NO HALLUCINATION:** Strictly forbidden from inventing scores or outcomes.
7.  **DO NOT RETURN THIS CONVERSATION:** Your entire response MUST be only the raw, valid JSON object.

Here are the matches to analyze:
${JSON.stringify(matchesToQuery, null, 2)}
`;

        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    systemInstruction: JSON_SYSTEM_INSTRUCTION,
                    tools: [{ googleSearch: {} }],
                    thinkingConfig: { thinkingBudget: 0 },
                },
            });

            const parsedData = parseJsonResponse<{ id: string; finalScore: string | null; betOutcome: 'Won' | 'Lost' | null }[]>(response.text);

            if (parsedData) {
                for (const item of parsedData) {
                    allNewScores[item.id] = { finalScore: item.finalScore, betOutcome: item.betOutcome };
                }
            }
        } catch (error) {
            console.error("Error fetching score batch:", error);
        }
        
        if (i + BATCH_SIZE < predictionsToFetch.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }
    
    for (const p of predictionsToFetch) {
        if (allNewScores[p.id] === undefined) {
            allNewScores[p.id] = { finalScore: null, betOutcome: null };
        }
    }

    const updatedCache = { ...cachedScores, ...allNewScores };
    setCachedData(cacheKey, updatedCache);

    const relevantScores: Record<string, PredictionResult> = {};
    for (const p of predictions) {
        if (updatedCache[p.id]) {
            relevantScores[p.id] = updatedCache[p.id];
        }
    }
    return relevantScores;
};

export const fetchSingleScore = async (prediction: MatchPrediction): Promise<PredictionResult | null> => {
    const ai = getAiClient();
    const matchToQuery = {
        id: prediction.id,
        teamA: prediction.teamA,
        teamB: prediction.teamB,
        matchDate: prediction.matchDate,
        recommendedBet: prediction.recommendedBet,
    };

    const prompt = `For the following completed sports match, use Google Search to find the final score AND determine if the recommended bet was won or lost.

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
1.  **EXTENSIVE REAL-TIME VERIFICATION:** You **MUST** use Google Search exhaustively. Cross-reference multiple reliable sports media outlets to find the official final score.
2.  **DETERMINE OUTCOME:** Compare the final score to the 'recommendedBet' to determine the outcome.
    - If the bet was correct, 'betOutcome' is "Won".
    - If the bet was incorrect, 'betOutcome' is "Lost".
    - For bets like "Over 2.5 Goals", calculate if the total goals meet the criteria.
3.  **STRICT JSON OUTPUT:** Your entire response must be a single, valid JSON object conforming to: \`{ "finalScore": "string", "betOutcome": "Won" | "Lost" | null }\`.
4.  **SCORE FORMAT:** The 'finalScore' should be a string like "2 - 1".
5.  **HANDLE MISSING DATA:** If you cannot find a definitive final score OR cannot determine the outcome, you **MUST** return a JSON object with 'finalScore' and 'betOutcome' values of \`null\`.
6.  **NO HALLUCINATION:** Strictly forbidden from inventing scores or outcomes.
7.  **DO NOT RETURN THIS CONVERSATION:** Your entire response MUST be only the raw, valid JSON object.

Here is the match to analyze:
${JSON.stringify(matchToQuery, null, 2)}
`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            systemInstruction: JSON_SYSTEM_INSTRUCTION,
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingBudget: 0 },
        },
    });

    const parsedData = parseJsonResponse<PredictionResult>(response.text);
    
    // Update cache for this single item
    if (parsedData) {
        const cacheKey = 'scoresCache';
        const cachedScores = getCachedData<Record<string, PredictionResult>>(cacheKey, SCORE_CACHE_DURATION_MS) || {};
        const updatedCache = { ...cachedScores, [prediction.id]: parsedData };
        setCachedData(cacheKey, updatedCache);
    }
    
    return parsedData;
};

export const fetchResultsForAccumulators = async (accumulators: AccumulatorTip[]): Promise<Record<string, AccumulatorResult>> => {
    const ai = getAiClient();
    const BATCH_SIZE = 10; // Accumulators are more complex, so a smaller batch size is safer.
    const DELAY_MS = 1000;   // 1 second delay between batches

    const cacheKey = 'accumulatorResultsCache';
    const cachedResults = getCachedData<Record<string, AccumulatorResult>>(cacheKey, SCORE_CACHE_DURATION_MS) || {};

    const accumulatorsToFetch = accumulators.filter(acc => cachedResults[acc.id] === undefined);
    
    if (accumulatorsToFetch.length === 0) {
        const relevantResults: Record<string, AccumulatorResult> = {};
        for(const acc of accumulators) {
            if(cachedResults[acc.id] !== undefined) {
                relevantResults[acc.id] = cachedResults[acc.id];
            }
        }
        return relevantResults;
    }

    const allNewResults: Record<string, AccumulatorResult> = {};

    for (let i = 0; i < accumulatorsToFetch.length; i += BATCH_SIZE) {
        const batch = accumulatorsToFetch.slice(i, i + BATCH_SIZE);
        
        const accumulatorsToQuery = batch.map(acc => ({
            id: acc.id,
            games: acc.games.map(g => ({
                teamA: g.teamA,
                teamB: g.teamB,
                prediction: g.prediction,
            })),
        }));

        const prompt = `For the following list of accumulators, you must determine the final result for each one.

**CRITICAL INSTRUCTIONS - NON-NEGOTIABLE:**
1.  **FOR EACH ACCUMULATOR:**
    a. **FOR EACH GAME (LEG) IN THE ACCUMULATOR:** Use Google Search exhaustively to find the final, official score, cross-referencing multiple sources.
    b. **DETERMINE LEG OUTCOME:** Compare the final score to the game's 'prediction' to determine if that leg was "Won" or "Lost".
    c. **DETERMINE FINAL ACCUMULATOR OUTCOME:**
        - If **any** leg in the accumulator was "Lost", the accumulator's 'finalOutcome' is "Lost".
        - If **all** legs were "Won", the 'finalOutcome' is "Won".
        - If any leg's result cannot be determined, the 'finalOutcome' is \`null\`.
2.  **STRICT JSON OUTPUT:** Your entire response must be a valid JSON array of result objects. Each object MUST conform to the schema.
3.  **HANDLE MISSING DATA:** If you cannot find a definitive result for a leg, its 'outcome' **MUST** be \`null\`. If any leg is \`null\`, the accumulator's 'finalOutcome' is also \`null\`. Do not omit any accumulator from the response.
4.  **NO HALLUCINATION:** Strictly forbidden from inventing scores or outcomes.
5.  **DO NOT RETURN THIS CONVERSATION:** Your entire response MUST be only the raw, valid JSON object.

**JSON OUTPUT SCHEMA:**
Your response must be an array, where each object is structured as follows:
\`{
  "id": "string", // The accumulator's ID
  "finalOutcome": "Won" | "Lost" | null,
  "legResults": [
    {
      "teamA": "string",
      "teamB": "string",
      "outcome": "Won" | "Lost" | null
    },
    ...
  ]
}\`

Here are the accumulators to analyze:
${JSON.stringify(accumulatorsToQuery, null, 2)}
`;
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    systemInstruction: JSON_SYSTEM_INSTRUCTION,
                    tools: [{ googleSearch: {} }],
                    thinkingConfig: { thinkingBudget: 0 },
                },
            });

            const parsedData = parseJsonResponse<AccumulatorResult[]>(response.text);

            if (parsedData) {
                for (const item of parsedData) {
                    allNewResults[item.id] = item;
                }
            }
        } catch (error) {
            console.error("Error fetching accumulator result batch:", error);
        }

        if (i + BATCH_SIZE < accumulatorsToFetch.length) {
            await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
    }

    for (const acc of accumulatorsToFetch) {
        if (allNewResults[acc.id] === undefined) {
            allNewResults[acc.id] = { 
                id: acc.id, 
                finalOutcome: null, 
                legResults: acc.games.map(g => ({ teamA: g.teamA, teamB: g.teamB, outcome: null }))
            };
        }
    }

    const updatedCache = { ...cachedResults, ...allNewResults };
    setCachedData(cacheKey, updatedCache);

    const relevantResults: Record<string, AccumulatorResult> = {};
    for (const acc of accumulators) {
        if (updatedCache[acc.id]) {
            relevantResults[acc.id] = updatedCache[acc.id];
        }
    }
    return relevantResults;
};