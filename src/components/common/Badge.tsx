import React from 'react';
import { ApplicationStatus } from '../../types';
import { getStageColorClasses, getStageLabel } from '../../utils/formatters';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'outline' | 'blue' | 'emerald' | 'amber' | 'rose';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variantStyles = {
    default: 'bg-slate-800 text-slate-300 border border-slate-700/80',
    outline: 'border border-slate-700 text-slate-400 bg-transparent',
    blue: 'bg-blue-950/50 text-blue-400 border border-blue-800/40',
    emerald: 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/40',
    amber: 'bg-amber-950/50 text-amber-400 border border-amber-800/40',
    rose: 'bg-rose-950/50 text-rose-400 border border-rose-800/40',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md whitespace-nowrap shrink-0 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export const ApplicationStageBadge: React.FC<{ stage: ApplicationStatus; className?: string }> = ({
  stage,
  className = '',
}) => {
  const colors = getStageColorClasses(stage);
  const label = getStageLabel(stage);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border ${colors.bg} ${colors.text} ${colors.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};
