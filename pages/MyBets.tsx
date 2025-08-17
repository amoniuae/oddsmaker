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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-center">My Tracked Bets</h1>
        
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