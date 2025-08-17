import React, { useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { FavoritePrediction, FavoriteAccumulator, PredictionResult, AccumulatorResult } from '../types';
import { safeNewDate } from '../utils/dateUtils';
import { useTheme } from '../contexts/ThemeContext';

Chart.register(...registerables);

interface PerformanceChartProps {
  favoritePredictions: FavoritePrediction[];
  favoriteAccumulators: FavoriteAccumulator[];
  predictionResults: Record<string, PredictionResult>;
  accumulatorResults: Record<string, AccumulatorResult>;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ 
  favoritePredictions, 
  favoriteAccumulators, 
  predictionResults, 
  accumulatorResults 
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  const { theme } = useTheme();

  const chartData = useMemo(() => {
    const settledPredictions = favoritePredictions
      .filter(p => predictionResults[p.id]?.betOutcome)
      .map(p => {
        const result = predictionResults[p.id];
        const pnl = result.betOutcome === 'Won' 
          ? p.virtualStake * (p.odds || 0) - p.virtualStake 
          : -p.virtualStake;
        return { date: safeNewDate(p.matchDate), pnl };
      });

    const settledAccumulators = favoriteAccumulators
      .filter(acc => accumulatorResults[acc.id]?.finalOutcome)
      .map(acc => {
        const result = accumulatorResults[acc.id];
        const pnl = result.finalOutcome === 'Won' 
          ? acc.virtualStake * (acc.combinedOdds || 0) - acc.virtualStake
          : -acc.virtualStake;
        const games = acc.games || [];
        const lastGameDate = games.reduce((latest, game) => {
            const gameDate = safeNewDate(game.matchDate);
            return gameDate > latest ? gameDate : latest;
        }, new Date(0));
        return { date: lastGameDate, pnl };
      });
      
    const allSettled = [...settledPredictions, ...settledAccumulators]
      .filter(item => item.date.getTime() !== 0) // Filter out items with invalid dates
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    let cumulativePnl = 0;
    const dataPoints = allSettled.map(item => {
      cumulativePnl += item.pnl;
      return { x: item.date.getTime(), y: cumulativePnl };
    });

    if (dataPoints.length > 0) {
        const firstDate = new Date(dataPoints[0].x);
        const dayBefore = new Date(firstDate.getTime() - 24 * 60 * 60 * 1000);
        dataPoints.unshift({ x: dayBefore.getTime(), y: 0 });
    } else {
        dataPoints.push({ x: new Date().getTime(), y: 0});
    }

    return dataPoints;
  }, [favoritePredictions, favoriteAccumulators, predictionResults, accumulatorResults]);

  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, chartRef.current.clientHeight);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.4)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

    const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const tickColor = theme === 'dark' ? '#9CA3AF' : '#4b5563';
    const tooltipBgColor = theme === 'dark' ? '#1F2937' : '#FFFFFF';
    const tooltipFontColor = theme === 'dark' ? '#E5E7EB' : '#1f2937';

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Virtual P/L',
          data: chartData,
          borderColor: '#2563eb',
          backgroundColor: gradient,
          fill: true,
          tension: 0.3,
          pointRadius: chartData.length < 50 ? 3 : 0,
          pointBackgroundColor: '#2563eb',
          pointHitRadius: 10,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            adapters: { date: { locale: enUS } },
            time: { unit: 'day', tooltipFormat: 'MMM d, yyyy' },
            grid: { color: gridColor },
            ticks: { color: tickColor },
          },
          y: {
            beginAtZero: false,
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              callback: value => typeof value === 'number' ? value.toLocaleString() : value,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: tooltipBgColor,
            titleColor: tooltipFontColor,
            bodyColor: tooltipFontColor,
            bodySpacing: 4,
            padding: 10,
            callbacks: {
              label: context => `P/L: ${context.parsed.y >= 0 ? '+' : ''}${context.parsed.y.toFixed(2)} units`,
            }
          },
        },
        interaction: { mode: 'index', intersect: false },
      },
    });

    return () => {
      chartInstanceRef.current?.destroy();
    };
  }, [chartData, theme]);
  
  const hasData = useMemo(() => chartData.length > 1, [chartData]);

  return (
    <div className="bg-white/85 dark:bg-slate-800/85 p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Virtual Profit/Loss Over Time</h2>
        <div className="relative h-64 md:h-80">
            {hasData ? (
                <canvas ref={chartRef} />
            ) : (
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 dark:text-slate-400">Track some bets to see your performance graph here.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default PerformanceChart;