import React from 'react';
import { Info, Sparkles, X } from 'lucide-react';

interface NoticeBannerProps {
  message?: string;
  badge?: string;
  className?: string;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({
  message = 'Enterprise Recruitment Environment: Operating with realistic sample data structured for FastAPI backend connectivity.',
  badge = 'SAMPLE ENVIRONMENT',
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3.5 py-2 bg-slate-900/90 border border-slate-800 text-slate-300 rounded-lg text-xs ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-400 uppercase tracking-wider shrink-0">
          {badge}
        </span>
        <span className="text-slate-300">{message}</span>
      </div>
      <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">OpenAPI 3.1 Ready</span>
    </div>
  );
};
