import React from 'react';
import { useAppStore } from '../stores/store';

export const ProgressBar: React.FC = () => {
  const { loading } = useAppStore();

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-[var(--app-bg)] overflow-hidden">
      <div className="h-full bg-[var(--app-primary)] animate-progress-indeterminate origin-left"></div>
    </div>
  );
};
