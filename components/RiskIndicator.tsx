import React from 'react';

interface RiskIndicatorProps {
  level: 'Low' | 'Medium' | 'High';
}

const RiskIndicator: React.FC<RiskIndicatorProps> = ({ level }) => {
  const levelConfig = {
    Low: { text: 'Low', colorClasses: 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700/50' },
    Medium: { text: 'Medium', colorClasses: 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700/50' },
    High: { text: 'High', colorClasses: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700/50' },
  };

  const config = levelConfig[level];

  if (!config) {
    return (
        <span className={`px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600`}>
            N/A Risk
        </span>
    );
  }

  const { text, colorClasses } = config;

  return (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${colorClasses}`}>
        {text} Risk
    </span>
  );
};

export default RiskIndicator;