import React, { useState, useEffect } from 'react';
import { MatchPrediction, AccumulatorTip } from '../types';
import {
  getFavoritePredictions,
  getFavoriteAccumulators,
  removeFavoritePrediction,
  removeFavoriteAccumulator
} from '../utils/favorites';
import MatchPredictionCard from '../components/MatchPredictionCard';
import AccumulatorCard from '../components/AccumulatorCard';
import Header from '../components/Header';
import Footer from '../components/Footer';

const MyBets: React.FC = () => {
  const [predictions, setPredictions] = useState<MatchPrediction[]>([]);
  const [accumulators, setAccumulators] = useState<AccumulatorTip[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [editingPrediction, setEditingPrediction] = useState<MatchPrediction | null>(null);
  const [editingAccumulator, setEditingAccumulator] = useState<AccumulatorTip | null>(null);

  useEffect(() => {
    // Load favorite predictions and accumulators
    const favPredictions = getFavoritePredictions();
    const favAccumulators = getFavoriteAccumulators();
    
    setPredictions(favPredictions);
    setAccumulators(favAccumulators);
  }, []);

  const handleRemovePrediction = (id: string) => {
    removeFavoritePrediction(id);
    setPredictions(prev => prev.filter(p => p.id !== id));
  };

  const handleRemoveAccumulator = (id: string) => {
    removeFavoriteAccumulator(id);
    setAccumulators(prev => prev.filter(a => a.id !== id));
  };

  const handleEditPrediction = (prediction: MatchPrediction) => {
    setEditingPrediction(prediction);
  };

  const handleEditAccumulator = (accumulator: AccumulatorTip) => {
    setEditingAccumulator(accumulator);
  };

  const handleSavePrediction = (updatedPrediction: MatchPrediction) => {
    // In a real app, this would update backend
    setPredictions(prev => prev.map(p =>
      p.id === updatedPrediction.id ? updatedPrediction : p
    ));
    setEditingPrediction(null);
  };

  const handleSaveAccumulator = (updatedAccumulator: AccumulatorTip) => {
    // In a real app, this would update backend
    setAccumulators(prev => prev.map(a =>
      a.id === updatedAccumulator.id ? updatedAccumulator : a
    ));
    setEditingAccumulator(null);
  };

  // Apply filters
  const filteredPredictions = predictions.filter(prediction => {
    if (statusFilter !== 'all' && prediction.status !== statusFilter) return false;
    if (sportFilter !== 'all' && prediction.sport !== sportFilter) return false;
    return true;
  });

  const filteredAccumulators = accumulators.filter(accumulator => {
    if (statusFilter !== 'all' && accumulator.status !== statusFilter) return false;
    if (sportFilter !== 'all' && accumulator.sport !== sportFilter) return false;
    return true;
  });

  // Apply sorting
  const sortedPredictions = [...filteredPredictions].sort((a, b) => {
    if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sortBy === 'stake') return b.stake - a.stake;
    if (sortBy === 'potential') return b.potentialReturn - a.potentialReturn;
    return 0;
  });

  const sortedAccumulators = [...filteredAccumulators].sort((a, b) => {
    if (sortBy === 'date') return new Date(b.date).getTime() - new Date(a.date).getTime();
    if (sortBy === 'stake') return b.stake - a.stake;
    if (sortBy === 'potential') return b.potentialReturn - a.potentialReturn;
    return 0;
  });

  const handleExport = () => {
    // Implement export logic
    alert('Export functionality will be implemented soon!');
  };

  // Calculate statistics
  const totalBets = predictions.length + accumulators.length;
  const wonBets = predictions.filter(p => p.status === 'won').length +
                  accumulators.filter(a => a.status === 'won').length;
  const winRate = totalBets > 0 ? Math.round((wonBets / totalBets) * 100) : 0;
  
  // Calculate profit
  const profit = predictions.reduce((sum, p) => {
    if (p.status === 'won') return sum + (p.potentialReturn - p.stake);
    if (p.status === 'lost') return sum - p.stake;
    return sum;
  }, 0) + accumulators.reduce((sum, a) => {
    if (a.status === 'won') return sum + (a.potentialReturn - a.stake);
    if (a.status === 'lost') return sum - a.stake;
    return sum;
  }, 0);
  
  // Calculate ROI
  const totalStake = predictions.reduce((sum, p) => sum + p.stake, 0) +
                     accumulators.reduce((sum, a) => sum + a.stake, 0);
  const roi = totalStake > 0 ? (profit / totalStake) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">My Tracked Bets</h1>
        
        {/* Filtering/Sorting Controls */}
        <div className="mb-8 p-4 bg-gray-800 rounded-lg">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Filter by Status</label>
              <select
                className="bg-gray-700 text-white rounded px-3 py-2 w-full"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Sort by</label>
              <select
                className="bg-gray-700 text-white rounded px-3 py-2 w-full"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="date">Date</option>
                <option value="stake">Stake Amount</option>
                <option value="potential">Potential Return</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Sport</label>
              <select
                className="bg-gray-700 text-white rounded px-3 py-2 w-full"
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
              >
                <option value="all">All Sports</option>
                <option value="football">Football</option>
                <option value="basketball">Basketball</option>
                <option value="tennis">Tennis</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Statistics Display */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold">Total Bets</h3>
            <p className="text-2xl">{predictions.length + accumulators.length}</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold">Win Rate</h3>
            <p className="text-2xl">62%</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold">Profit/Loss</h3>
            <p className="text-2xl text-green-500">+$245.50</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="font-semibold">ROI</h3>
            <p className="text-2xl">18.7%</p>
          </div>
        </div>
        
        {/* Export Button */}
        <div className="flex justify-end mb-6">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
            onClick={handleExport}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export Bets
          </button>
        </div>
        
        {/* Individual Predictions Section */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-6">Individual Predictions</h2>
          
          {predictions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No tracked predictions yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {predictions.map(prediction => (
                <div key={prediction.id} className="relative">
                  <MatchPredictionCard prediction={prediction} />
                  <button 
                    onClick={() => handleRemovePrediction(prediction.id)}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
        
        {/* Accumulator Bets Section */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Accumulator Bets</h2>
          
          {accumulators.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No tracked accumulators yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {accumulators.map(accumulator => (
                <div key={accumulator.id} className="relative">
                  <AccumulatorCard accumulator={accumulator} />
                  <button 
                    onClick={() => handleRemoveAccumulator(accumulator.id)}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-full"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default MyBets;