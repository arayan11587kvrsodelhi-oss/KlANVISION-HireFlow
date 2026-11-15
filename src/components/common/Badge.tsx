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
    default: 'bg-slate-100 text-slate-600 border border-slate-200',
    outline: 'border border-slate-300 text-slate-500 bg-white/60',
    blue: 'bg-blue-50 text-blue-600 border border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border border-amber-200',
    rose: 'bg-rose-50 text-rose-600 border border-rose-200',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-lg whitespace-nowrap shrink-0 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${colors.bg} ${colors.text} ${colors.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};
