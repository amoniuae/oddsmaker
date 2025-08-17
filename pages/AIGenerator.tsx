import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AccumulatorTip, FootballPageData, HydratedStrategy, SavedStrategy, AIRecommendation } from '../types';
import Spinner from '../components/Spinner';
import AccumulatorCard from '../components/AccumulatorCard';
import { useFavorites } from '../contexts/FavoritesContext';
import { StakeModal } from '../components/StakeModal';
import { ShareModal } from '../components/ShareModal';
import { Modal } from '../components/Modal';
import { BetTypeIcon, MagicWandIcon } from '../components/icons';
import { fetchAIRecommendedStrategy, generateCustomAccumulator } from '../services/geminiService';

const betTypes = [
  'Home Win', 'Away Win', 'Draw', 
  'Over 1.5 Goals', 'Over 2.5 Goals', 'Over 3.5 Goals',
  'Under 1.5 Goals', 'Under 2.5 Goals', 'Under 3.5 Goals',
  'BTTS (Yes)', 'Double Chance', 'Draw No Bet', 'Win to Nil', 
  'Asian Handicap', 'Half-Time Result', 'Correct Score'
];

const getProbabilityInfo = (prob: number) => {
    if (prob < 60) return { label: "High Reward", color: "text-red-400", trackColor: "bg-red-500/10", thumbColor: "bg-red-500" };
    if (prob < 80) return { label: "Balanced Risk", color: "text-yellow-400", trackColor: "bg-yellow-500/10", thumbColor: "bg-yellow-500" };
    return { label: "High Confidence", color: "text-green-400", trackColor: "bg-green-500/10", thumbColor: "bg-green-500" };
};

const AccordionSection: React.FC<{
  step: number; title: string; isOpen: boolean; onClick: () => void; children: React.ReactNode;
}> = ({ step, title, isOpen, onClick, children }) => (
    <div className="border-b border-white/10">
      <button className="w-full flex justify-between items-center py-4" onClick={onClick} aria-expanded={isOpen}>
        <div className="flex items-center gap-4">
            <span className={`flex items-center justify-center h-8 w-8 rounded-full font-bold transition-colors ${isOpen ? 'bg-brand-primary text-white' : 'bg-brand-secondary text-brand-text'}`}>{step}</span>
            <h3 className="text-lg font-semibold text-brand-text">{title}</h3>
        </div>
        <svg className={`h-6 w-6 text-brand-text-secondary transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="pb-6 pl-12 space-y-6">{children}</div>}
    </div>
);

const BetTypeButton: React.FC<{ bet: string; isSelected: boolean; onClick: () => void; isDisabled?: boolean; }> = ({ bet, isSelected, onClick, isDisabled }) => (
    <button onClick={onClick} disabled={isDisabled} className={`flex flex-col items-center justify-center text-center gap-2 p-3 rounded-lg w-28 h-24 border-2 transition-all duration-200 transform hover:scale-105 ${isSelected ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-lg shadow-brand-primary/20' : 'bg-brand-secondary border-transparent text-brand-text-secondary hover:bg-brand-primary/5 hover:border-brand-primary/20'} ${isDisabled ? 'opacity-40 cursor-not-allowed scale-95 hover:scale-95' : ''}`}>
        <BetTypeIcon betType={bet} className="h-8 w-8" />
        <span className="text-xs font-semibold">{bet}</span>
    </button>
);

const AIGenerator: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    // Strategy state
    const [strategyId, setStrategyId] = useState<string | null>(location.state?.strategyId || null);
    const [strategyName, setStrategyName] = useState<string | null>(location.state?.strategyName || null);
    const [selectedBetTypes, setSelectedBetTypes] = useState<string[]>(['Home Win', 'Over 2.5 Goals']);
    const [customNlp, setCustomNlp] = useState('');
    const [numGames, setNumGames] = useState(4);
    const [successProbability, setSuccessProbability] = useState(75);
    const [timeFrame, setTimeFrame] = useState('3 days');
    const [aiSelectsMarkets, setAiSelectsMarkets] = useState(false);
    
    // UI/Flow state
    const [loading, setLoading] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [recommendationRationale, setRecommendationRationale] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generatedTip, setGeneratedTip] = useState<AccumulatorTip | null>(null);
    const [strategyForGeneratedTip, setStrategyForGeneratedTip] = useState<any>(null);

    const { 
        trackedAccumulators, addAccumulator, removeAccumulator, 
        saveNewStrategy, saveNewVersion, strategies 
    } = useFavorites();

    const [isStakeModalOpen, setStakeModalOpen] = useState(false);
    const [isShareModalOpen, setShareModalOpen] = useState(false);
    const [isSaveModalOpen, setSaveModalOpen] = useState(false);
    const [activeSection, setActiveSection] = useState(1);
    
    const getCurrentState = () => ({
        selectedBetTypes, customNlp, numGames, successProbability, timeFrame, aiSelectsMarkets
    });
    
    const loadState = useCallback((stateToLoad: any) => {
        setSelectedBetTypes(stateToLoad.selectedBetTypes || ['Home Win']);
        setCustomNlp(stateToLoad.customNlp || '');
        setNumGames(stateToLoad.numGames || 4);
        setSuccessProbability(stateToLoad.successProbability || 75);
        setTimeFrame(stateToLoad.timeFrame || '3 days');
        setAiSelectsMarkets(stateToLoad.aiSelectsMarkets || false);
    }, []);
    
    useEffect(() => {
        const state = location.state;
        if (state?.strategyParameters) {
            loadState(state.strategyParameters);
        }
        if (state?.strategyId) setStrategyId(state.strategyId);
        if (state?.strategyName) setStrategyName(state.strategyName);

        if(state) {
            const builderPanel = document.getElementById('ai-builder-panel');
            if (builderPanel) builderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
            navigate(location.pathname, { replace: true });
        }
    }, [location.state, loadState, navigate]);

    const handleSave = () => {
        const currentState = getCurrentState();
        if (strategyId) { // Existing strategy, save as new version
            const changelog = prompt(`Enter a changelog for this new version of "${strategyName}":`);
            if (changelog !== null) { // Handle cancel
                saveNewVersion(strategyId, currentState, changelog).then(version => {
                    if (version) alert(`Successfully saved v${version.version_number} of "${strategyName}"!`);
                });
            }
        } else { // New strategy
            setSaveModalOpen(true);
        }
    };
    
    const handleSaveNewStrategy = async (name: string, description?: string) => {
        const currentState = getCurrentState();
        const newStrategy = await saveNewStrategy(name, description, currentState, 'Initial version');
        if (newStrategy) {
            setStrategyId(newStrategy.id);
            setStrategyName(newStrategy.name);
            alert(`Strategy "${name}" saved successfully!`);
        }
        setSaveModalOpen(false);
    };

    const handleGenerate = useCallback(async () => {
        setLoading(true);
        setError(null);
        setGeneratedTip(null);
        setRecommendationRationale(null);

        const currentState = getCurrentState();
        setStrategyForGeneratedTip(currentState);

        const getRiskLevelFromProbability = (prob: number): 'Low' | 'Medium' | 'High' => {
            if (prob >= 80) return 'Low';
            if (prob >= 60) return 'Medium';
            return 'High';
        };
        const calculatedRiskLevel = getRiskLevelFromProbability(successProbability);

        let betTypesInstruction = aiSelectsMarkets 
            ? "You have full autonomy. Analyze all available betting markets and choose the single most valuable market for each game to include in the accumulator. Prioritize value and alignment with the user's overall strategy."
            : `Focus on these primary bet types: [${selectedBetTypes.join(', ')}]`;

        try {
            const parsedData = await generateCustomAccumulator(
                betTypesInstruction,
                customNlp,
                timeFrame,
                numGames,
                successProbability,
                calculatedRiskLevel
            );

            if (parsedData?.games && parsedData.games.length > 0) {
                setGeneratedTip(parsedData);
            } else {
                setError(parsedData?.rationale || "The AI could not generate a tip. Try a different success probability or broaden your criteria.");
            }
        } catch (err) {
            console.error(err);
            setError("An unexpected error occurred. Please check the console and try again.");
        } finally {
            setLoading(false);
        }
    }, [aiSelectsMarkets, selectedBetTypes, customNlp, numGames, successProbability, timeFrame]);

    const handleRecommendStrategy = async () => {
        setIsRecommending(true);
        setError(null);
        setRecommendationRationale(null);
        try {
             const tempStrategies = strategies.map(s => ({
                id: s.id, name: s.name, parameters: s.deployed_version?.content || {}, wins: s.wins, losses: s.losses, pnl: s.pnl,
            }));
            // @ts-ignore
            const recommendation = await fetchAIRecommendedStrategy(tempStrategies);
            if (recommendation && recommendation.strategy) {
                loadState(recommendation.strategy);
                setRecommendationRationale(recommendation.rationale);
                setStrategyId(null); // Recommended strategy is a new one, not linked to an existing ID
                setStrategyName(null);
            } else {
                setError("AI could not generate a recommendation. Not enough data perhaps?");
            }
        } catch (err) {
            console.error(err);
            setError("An error occurred while fetching AI recommendation.");
        } finally {
            setIsRecommending(false);
        }
    };

    const handleToggleTrack = async (tip: AccumulatorTip) => {
        const isTracked = trackedAccumulators.some(a => a.id === tip.id);
        if (isTracked) {
            if (window.confirm("Are you sure you want to untrack this accumulator?")) removeAccumulator(tip.id);
        } else {
            setStakeModalOpen(true);
        }
    };

    const handleStakeSubmit = async (stake: number) => {
        if (generatedTip && strategyForGeneratedTip && stake > 0) {
            let sId = strategyId;
            let vId: string | undefined = undefined;
            // If there's no strategyId, or the current params don't match the last known state for this ID, we need to save a new version.
            if (!sId) {
                const name = prompt("Enter a name for this new strategy to track its performance:", generatedTip.name);
                if (name) {
                    const newStrat = await saveNewStrategy(name, "Generated from Tip Builder", strategyForGeneratedTip, "Initial version from generated tip");
                    if (newStrat) {
                        sId = newStrat.id;
                        vId = newStrat.deployed_version?.id;
                    }
                } else { // User cancelled
                    setStakeModalOpen(false);
                    return;
                }
            }
            
            if (sId) {
                // If the tip was generated from a known strategy, we should link it to that strategy.
                // For simplicity, we assume the generated tip is based on the currently loaded parameters.
                // A more robust system would pass version info around.
                await addAccumulator(generatedTip, stake, sId, vId);
            } else {
                 await addAccumulator(generatedTip, stake);
            }
        }
        setStakeModalOpen(false);
    };

    const handleAiSelectClick = () => { setAiSelectsMarkets(true); setSelectedBetTypes([]); };
    
    const handleBetTypeClick = (bet: string) => {
      setAiSelectsMarkets(false);
      setSelectedBetTypes(prev => prev.includes(bet) ? prev.length > 1 ? prev.filter(b => b !== bet) : prev : [...prev, bet]);
    };
    
    const probInfo = getProbabilityInfo(successProbability);
    const isGeneratedTipTracked = generatedTip ? trackedAccumulators.some(a => a.id === generatedTip.id) : false;
    const trackedData = isGeneratedTipTracked ? trackedAccumulators.find(a => a.id === generatedTip?.id) : undefined;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-brand-text mb-4">AI-Powered <span className="text-brand-primary">Tip Builder</span></h1>
                <p className="text-lg md:text-xl text-brand-text-secondary max-w-3xl mx-auto mb-12">Craft a hyper-specific betting strategy and let our AI build the perfect accumulator for you.</p>
            </div>
            {recommendationRationale && (
                <div className="mb-8 p-4 bg-blue-900/30 border border-blue-500/50 rounded-lg shadow-lg">
                    <h4 className="font-bold text-blue-300 flex items-center gap-2"><MagicWandIcon className="h-5 w-5"/> AI Recommendation</h4>
                    <p className="text-sm text-blue-200 italic mt-1">"{recommendationRationale}"</p>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8" id="ai-builder-panel">
                <div className="lg:col-span-3">
                    <div className="bg-brand-surface/70 backdrop-blur-md border border-brand-secondary/50 rounded-lg shadow-2xl p-6 lg:p-8 space-y-4">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <h2 className="text-2xl font-bold text-brand-text">{strategyName ? `Tweak: ${strategyName}`: 'New Strategy'}</h2>
                            <div className="flex items-center gap-2">
                                <button onClick={handleSave} className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-brand-secondary text-brand-text-secondary hover:bg-opacity-80">Save</button>
                                <button onClick={() => {}} className="px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-brand-secondary text-brand-text-secondary hover:bg-opacity-80 disabled:opacity-50" disabled>Load</button>
                                <button onClick={handleRecommendStrategy} disabled={isRecommending} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-blue-600/80 text-white hover:bg-blue-600 disabled:bg-brand-secondary disabled:cursor-not-allowed">
                                    <MagicWandIcon className={`h-4 w-4 ${isRecommending ? 'animate-pulse' : ''}`}/> {isRecommending ? 'Analyzing...' : 'AI Reco'}
                                </button>
                            </div>
                        </div>

                        <AccordionSection step={1} title="The Core Idea" isOpen={activeSection === 1} onClick={() => setActiveSection(1)}>
                            <div><label htmlFor="custom-nlp" className="block font-medium text-brand-text mb-1">Custom Instructions (Optional)</label><textarea id="custom-nlp" rows={3} value={customNlp} onChange={e => setCustomNlp(e.target.value)} className="w-full bg-brand-bg border border-brand-secondary text-brand-text rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none" placeholder="e.g., Teams that score late goals playing against teams with tired defenses." /></div>
                        </AccordionSection>
                        
                        <AccordionSection step={2} title="Betting Markets" isOpen={activeSection === 2} onClick={() => setActiveSection(2)}>
                            <p className="text-brand-text-secondary text-sm -mt-2 mb-4">Manually select markets or let the AI choose the best value.</p>
                            <button onClick={handleAiSelectClick} className={`w-full flex items-center justify-center gap-3 text-center p-4 rounded-lg border-2 transition-all duration-200 mb-4 transform hover:scale-102 ${aiSelectsMarkets ? 'bg-brand-primary/10 border-brand-primary text-brand-primary shadow-lg shadow-brand-primary/20' : 'bg-brand-secondary border-transparent text-brand-text-secondary hover:bg-brand-primary/5 hover:border-brand-primary/20'}`}>
                                <MagicWandIcon className="h-6 w-6" /><span className="text-md font-semibold">Let AI Decide</span>
                            </button>
                            <div className="flex flex-wrap gap-2">{betTypes.map(bet => <BetTypeButton key={bet} bet={bet} isSelected={selectedBetTypes.includes(bet)} onClick={() => handleBetTypeClick(bet)} isDisabled={aiSelectsMarkets} /> )}</div>
                        </AccordionSection>

                        <AccordionSection step={3} title="Risk & Structure" isOpen={activeSection === 3} onClick={() => setActiveSection(3)}>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label htmlFor="numGames" className="block font-medium text-brand-text mb-1">Number of Games</label><div className="flex items-center gap-4 bg-brand-bg p-3 rounded-md"><input id="numGames" type="range" min="2" max="10" value={numGames} onChange={e => setNumGames(parseInt(e.target.value, 10))} className="w-full h-2 bg-brand-secondary rounded-lg appearance-none cursor-pointer" /><span className="font-bold text-brand-text text-lg w-8 text-center">{numGames}</span></div>{numGames > 8 && <p className="text-xs text-yellow-400 mt-1">Warning: Win rate for {numGames} legs is extremely low.</p>}</div>
                                 <div><label htmlFor="timeFrame" className="block font-medium text-brand-text mb-1">Timeframe</label><select id="timeFrame" value={timeFrame} onChange={e => setTimeFrame(e.target.value)} className="w-full bg-brand-bg border border-brand-secondary text-brand-text rounded-md p-2.5 focus:ring-2 focus:ring-brand-primary focus:outline-none">{['2 hours', '24 hours', '2 days', '3 days', '7 days'].map(option => <option key={option} value={option}>{option}</option>)}</select></div>
                             </div>
                             <div className={`p-4 rounded-lg border-2 transition-colors duration-300 ${probInfo.trackColor.replace('bg-','border-').replace('/10','/40')} ${probInfo.trackColor}`}>
                                <div className="flex justify-between items-center mb-2"><label htmlFor="successProbability" className="block font-semibold text-lg text-brand-text">Risk Appetite</label><span className={`px-3 py-1 text-sm font-bold rounded-full text-white ${probInfo.thumbColor}`}>{probInfo.label}</span></div>
                                <p className="text-sm text-brand-text-secondary mb-4">Guide the AI by setting a target success probability for the accumulator.</p>
                                <div className="w-full text-center mb-4"><span className="text-4xl font-bold text-brand-text">{successProbability}<span className="text-2xl text-brand-text-secondary">%</span></span><p className="text-xs text-brand-text-secondary">Target Success Probability</p></div>
                                <input id="successProbability" type="range" min="50" max="95" step="5" value={successProbability} onChange={e => setSuccessProbability(parseInt(e.target.value, 10))} className="w-full h-2 bg-brand-secondary rounded-lg appearance-none cursor-pointer" />
                                <div className="flex justify-between text-xs text-brand-text-secondary mt-1"><span>Lower Risk / Higher %</span><span>Higher Risk / Lower %</span></div>
                            </div>
                        </AccordionSection>

                        <div className="pt-6 border-t border-brand-secondary"><button onClick={handleGenerate} disabled={loading} className="w-full flex items-center justify-center gap-3 bg-brand-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-brand-primary-hover transition-transform duration-300 transform hover:scale-105 disabled:bg-brand-secondary disabled:cursor-not-allowed disabled:scale-100">{loading ? <> <Spinner size="sm" /> <span>Building Your Tip...</span> </> : <><MagicWandIcon className="h-6 w-6" /><span>Build My Custom Tip</span></>}</button></div>
                    </div>
                </div>

                <div className="lg:col-span-2"><div className="sticky top-24"><h2 className="text-2xl font-bold text-brand-text mb-4">AI Generated Result</h2><div className="bg-brand-surface/70 backdrop-blur-md border border-brand-secondary/50 rounded-lg shadow-2xl p-4 min-h-[400px] flex flex-col justify-center">{loading && <div className="text-center py-8"><Spinner size="lg" /></div>}{error && <p className="text-red-400 bg-red-900/20 border border-red-500/50 p-4 rounded-md text-center">{error}</p>}{!loading && !error && !generatedTip && <div className="text-center text-brand-text-secondary p-4"><svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-brand-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.375 3.375 0 0014 18.442V18.75a3.375 3.375 0 00-3.375-3.375H12a3.375 3.375 0 00-3.375-3.375v-.308A3.375 3.375 0 006 12.343l-.547-.547a5 5 0 017.072 0z" /></svg><h3 className="text-lg font-semibold text-brand-text">Your generated tip will appear here.</h3><p className="mt-1">Adjust the parameters on the left and click "Build My Custom Tip" to start.</p></div>}{generatedTip && <div className="w-full"><AccumulatorCard tip={generatedTip} onToggleTrack={() => handleToggleTrack(generatedTip)} isTracked={isGeneratedTipTracked} virtualStake={trackedData?.virtualStake} /><div className="mt-4 flex justify-center gap-2"><button onClick={() => setShareModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700">Share</button><button onClick={() => { if(generatedTip) { navigator.clipboard.writeText(JSON.stringify(generatedTip, null, 2)); alert('Copied tip data as JSON!'); } }} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-brand-secondary text-brand-text hover:bg-opacity-80">Copy JSON</button></div></div>}</div></div></div>
            </div>
            
            <StakeModal isOpen={isStakeModalOpen} onClose={() => setStakeModalOpen(false)} onSubmit={handleStakeSubmit} itemName={generatedTip?.name} />
            <ShareModal isOpen={isShareModalOpen} onClose={() => setShareModalOpen(false)} data={generatedTip ? { accumulators: [generatedTip] } : null} title={generatedTip?.name || "Custom AI-Generated Tip"} />
            
            <Modal isOpen={isSaveModalOpen} onClose={() => setSaveModalOpen(false)} title="Save New Strategy">
                <SaveStrategyForm onSave={handleSaveNewStrategy} />
            </Modal>
        </div>
    );
};

const SaveStrategyForm: React.FC<{onSave: (name: string, description?: string) => void}> = ({ onSave }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            onSave(name.trim(), description.trim());
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="strategy-name" className="block text-sm font-medium text-brand-text mb-1">Strategy Name</label>
                <input id="strategy-name" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-brand-bg border border-brand-secondary text-white rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none" />
            </div>
             <div>
                <label htmlFor="strategy-desc" className="block text-sm font-medium text-brand-text mb-1">Description (Optional)</label>
                <textarea id="strategy-desc" value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full bg-brand-bg border border-brand-secondary text-white rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none" />
            </div>
            <div className="flex justify-end pt-2">
                 <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors">Save Strategy</button>
            </div>
        </form>
    );
};

export default AIGenerator;