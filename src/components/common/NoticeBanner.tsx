import React from 'react';
import { Info, Sparkles, X } from 'lucide-react';

interface NoticeBannerProps {
  message?: string;
  badge?: string;
  className?: string;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({
  message = 'HireFlow is connected to its API: changes are saved to the database.',
  badge = 'NOTICE',
  className = '',
}) => {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white/70 backdrop-blur-lg border border-slate-200/70 text-slate-600 rounded-xl text-xs shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-600 uppercase tracking-wider shrink-0">
          {badge}
        </span>
        <span className="text-slate-600">{message}</span>
      </div>
      <span className="text-[11px] font-medium text-emerald-600 hidden sm:inline">Live data</span>
    </div>
  );
};
