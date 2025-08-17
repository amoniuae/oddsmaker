import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from './Modal';
import { HydratedStrategy, StrategyVersion } from '../types';
import { useFavorites } from '../contexts/FavoritesContext';
import Spinner from './Spinner';
import { RollbackIcon } from './icons';
import { safeNewDate } from '../utils/dateUtils';

interface StrategyVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategy: HydratedStrategy;
}

const VersionRow: React.FC<{
  version: StrategyVersion;
  isDeployed: boolean;
  onRollback: (versionId: string) => void;
  isRollingBack: boolean;
  isLatest: boolean;
}> = ({ version, isDeployed, onRollback, isRollingBack, isLatest }) => {
    const formattedDate = safeNewDate(version.created_at).toLocaleString('en-GH', { 
        dateStyle: 'medium', 
        timeStyle: 'short',
        timeZone: 'Africa/Accra'
    });

    return (
        <div className="p-3 bg-brand-bg rounded-md border border-brand-secondary/50">
            <div className="flex justify-between items-center gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-brand-text">Version {version.version_number}</h4>
                        {isDeployed && (
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-500/20 text-green-400">Deployed</span>
                        )}
                        {isLatest && !isDeployed && (
                             <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-yellow-500/20 text-yellow-400">Latest</span>
                        )}
                    </div>
                    <p className="text-xs text-brand-text-secondary">Created by {version.author || 'system'} on {formattedDate}</p>
                </div>
                {!isDeployed && (
                     <button
                        onClick={() => onRollback(version.id)}
                        disabled={isRollingBack}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-brand-secondary disabled:cursor-not-allowed"
                        aria-label={`Rollback to version ${version.version_number}`}
                    >
                        <RollbackIcon className="h-4 w-4" />
                        Deploy
                    </button>
                )}
            </div>
            {version.changelog && (
                <p className="text-sm italic text-brand-text-secondary mt-2 pl-2 border-l-2 border-brand-secondary">
                    "{version.changelog}"
                </p>
            )}
        </div>
    );
};

export const StrategyVersionsModal: React.FC<StrategyVersionsModalProps> = ({ isOpen, onClose, strategy }) => {
    const { fetchStrategyVersions, rollbackStrategy } = useFavorites();
    const [versions, setVersions] = useState<StrategyVersion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRollingBack, setIsRollingBack] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadVersions = useCallback(async () => {
        if (!strategy) return;
        setIsLoading(true);
        setError(null);
        try {
            const fetchedVersions = await fetchStrategyVersions(strategy.id);
            setVersions(fetchedVersions);
        } catch (err) {
            console.error("Error fetching strategy versions:", err);
            setError("Could not load version history.");
        } finally {
            setIsLoading(false);
        }
    }, [strategy, fetchStrategyVersions]);

    useEffect(() => {
        if (isOpen) {
            loadVersions();
        }
    }, [isOpen, loadVersions]);
    
    const handleRollback = async (versionId: string) => {
        if (!strategy || !window.confirm("Are you sure you want to deploy this version? This will become the new active version for this strategy.")) return;
        setIsRollingBack(true);
        try {
            await rollbackStrategy(strategy.id, versionId);
            onClose(); // Close the modal to show the updated state on the main page.
        } catch (err) {
            console.error("Rollback failed:", err);
            setError("Failed to perform rollback.");
        } finally {
            setIsRollingBack(false);
        }
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="py-8"><Spinner size="md" /></div>;
        }
        if (error) {
            return <p className="text-center text-red-500 py-8">{error}</p>;
        }
        if (versions.length === 0) {
            return <p className="text-center text-brand-text-secondary py-8">No version history found for this strategy.</p>;
        }
        return (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                {versions.map((v, index) => (
                    <VersionRow 
                        key={v.id} 
                        version={v} 
                        isDeployed={v.id === strategy.deployed_version?.id}
                        isLatest={index === 0}
                        onRollback={handleRollback}
                        isRollingBack={isRollingBack}
                    />
                ))}
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Version History: ${strategy.name}`}>
            {renderContent()}
        </Modal>
    );
};