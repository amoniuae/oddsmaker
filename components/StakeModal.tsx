import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useFavorites } from '../contexts/FavoritesContext';

interface StakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (stake: number) => void;
  itemName?: string;
}

export const StakeModal: React.FC<StakeModalProps> = ({ isOpen, onClose, onSubmit, itemName }) => {
  const [stake, setStake] = useState<string>('10');
  const [error, setError] = useState<string>('');
  const { availableBalance } = useFavorites();

  useEffect(() => {
    if (isOpen) {
      setStake('10'); // Reset to default when opened
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const stakeValue = parseFloat(stake);
    if (isNaN(stakeValue) || stakeValue <= 0) {
      setError('Please enter a positive number for the stake.');
      return;
    }
    if (stakeValue > availableBalance) {
        if (!window.confirm(`This stake of ${stakeValue.toFixed(2)} exceeds your available balance of ${availableBalance.toFixed(2)}. This will result in a negative virtual balance. Are you sure you want to proceed?`)) {
            return;
        }
    }
    onSubmit(stakeValue);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Track Bet with Virtual Stake">
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
          Enter a virtual stake amount to track this bet's performance on your dashboard.
        </p>
        <div className="text-right text-sm mb-2">
            Available Funds: <span className="font-bold text-brand-primary">{availableBalance.toFixed(2)}</span>
        </div>
        {itemName && (
          <div className="mb-4 p-3 bg-gray-100 dark:bg-slate-700 rounded-md border border-gray-200 dark:border-slate-600">
            <span className="text-xs text-gray-500 dark:text-slate-400">Tracking:</span>
            <p className="font-semibold text-gray-800 dark:text-slate-200">{itemName}</p>
          </div>
        )}
        
        <div>
          <label htmlFor="stake-amount" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Virtual Stake (units)
          </label>
          <input
            type="number"
            id="stake-amount"
            value={stake}
            onChange={(e) => {
              setStake(e.target.value);
              setError('');
            }}
            className="w-full bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 text-gray-800 dark:text-slate-200 rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none"
            placeholder="e.g., 10"
            step="0.01"
            min="0.01"
            autoFocus
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-500 mt-4 italic">
          Disclaimer: All stakes and performance metrics are for tracking and entertainment purposes only. This does not involve real money.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors"
          >
            Track Bet
          </button>
        </div>
      </form>
    </Modal>
  );
};