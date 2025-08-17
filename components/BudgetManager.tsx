import React, { useState } from 'react';
import { useFavorites } from '../contexts/FavoritesContext';
import { Modal } from './Modal';
import { BanknotesIcon } from './icons';

const formatCurrency = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
};

const BudgetEditor: React.FC<{ initialValue: number; onSave: (newValue: number) => void; onClose: () => void }> = ({ initialValue, onSave, onClose }) => {
    const [value, setValue] = useState(initialValue.toString());
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
            setError('Please enter a valid, non-negative number.');
            return;
        }
        onSave(numValue);
        onClose();
    };

    return (
        <form onSubmit={handleSubmit}>
            <p className="text-sm text-brand-text-secondary mb-4">
                Set your total starting budget for virtual tracking. This will be the baseline for your P/L calculations.
            </p>
            <div>
                <label htmlFor="budget-amount" className="block text-sm font-medium text-brand-text mb-1">
                    Initial Budget (units)
                </label>
                <input
                    type="number"
                    id="budget-amount"
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        setError('');
                    }}
                    className="w-full bg-brand-secondary border border-gray-200 text-brand-text rounded-md p-2 focus:ring-2 focus:ring-brand-primary focus:outline-none"
                    placeholder="e.g., 1000"
                    step="1"
                    min="0"
                    autoFocus
                />
                {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
             <div className="mt-6 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-md bg-brand-secondary text-brand-text hover:bg-gray-200 transition-colors">
                    Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm font-medium rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover transition-colors">
                    Save Budget
                </button>
            </div>
        </form>
    );
};


export const BudgetManager: React.FC = () => {
    const { initialBudget, setInitialBudget, totalPnL, totalStaked, availableBalance } = useFavorites();
    const [isEditModalOpen, setEditModalOpen] = useState(false);

    return (
        <>
            <div className="bg-brand-surface p-6 rounded-lg shadow-lg border-t-4 border-green-500">
                <div className="flex justify-between items-center gap-3 mb-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <BanknotesIcon className="h-8 w-8 text-green-400"/>
                        <h2 className="text-2xl font-bold text-white">Budget & Performance</h2>
                    </div>
                    <button
                        onClick={() => setEditModalOpen(true)}
                        className="text-sm font-semibold bg-brand-secondary text-white py-2 px-4 rounded-md hover:bg-opacity-80 transition-colors"
                    >
                        Edit Budget
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-sm text-brand-text-secondary">Initial Budget</p>
                        <p className="text-xl font-bold text-white">{initialBudget.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-brand-text-secondary">Total P/L</p>
                        <p className={`text-xl font-bold ${totalPnL > 0 ? 'text-green-400' : totalPnL < 0 ? 'text-red-400' : 'text-white'}`}>
                            {formatCurrency(totalPnL)}
                        </p>
                    </div>
                    <div>
                        <p className="text-sm text-brand-text-secondary">Staked</p>
                        <p className="text-xl font-bold text-yellow-400">{totalStaked.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-sm text-brand-text-secondary">Available Balance</p>
                        <p className="text-xl font-bold text-blue-400">{availableBalance.toFixed(2)}</p>
                    </div>
                </div>
            </div>
            <Modal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} title="Set Initial Budget">
                <BudgetEditor
                    initialValue={initialBudget}
                    onSave={setInitialBudget}
                    onClose={() => setEditModalOpen(false)}
                />
            </Modal>
        </>
    );
};
