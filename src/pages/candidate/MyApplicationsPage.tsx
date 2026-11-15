import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Application, ApplicationStatus, APPLICATION_STATUSES } from '../../types';
import { applicationService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { ApplicationStageBadge } from '../../components/common/Badge';

import { Button } from '../../components/common/Button';





import { NoticeBanner } from '../../components/common/NoticeBanner';








import { EmptyState } from '../../components/common/EmptyState';

import {
  Send,
  Building2,
  Clock,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

export const MyApplicationsPage: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | ApplicationStatus>('all');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchApps = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        // Scoped server-side to the token's user.
        const apps = await applicationService.getCandidateApplications();
        if (!cancelled) setApplications(apps);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load applications', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load your applications.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchApps();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredApps = applications.filter((app) => {
    if (activeFilter === 'all') return true;
    return app.status === activeFilter;
  });

  const counts = {
    all: applications.length,
    Applied: applications.filter((a) => a.status === 'Applied').length,
    Shortlisted: applications.filter((a) => a.status === 'Shortlisted').length,
    Interview: applications.filter((a) => a.status === 'Interview').length,
    Selected: applications.filter((a) => a.status === 'Selected').length,
    Rejected: applications.filter((a) => a.status === 'Rejected').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            My Applications & Pipeline Tracking
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stage transparency and feedback notes from hiring managers.
          </p>
        </div>

        <Link to="/jobs">
          <Button variant="primary" size="sm">
            Explore Open Roles
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 glass-panel rounded-xl overflow-x-auto">
        {(['all', ...APPLICATION_STATUSES] as const).map((filter) => {
          const count = filter === 'all' ? counts.all : counts[filter];
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>{filter === 'all' ? 'All Applications' : filter}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isActive ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {errorMessage && <NoticeBanner badge="LOAD ERROR" message={errorMessage} />}

      {/* Applications List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div key={n} className="p-6 glass-panel rounded-2xl animate-pulse h-40" />
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No applications in this category"
          description="Submit an application to an open position to begin tracking your hiring progress."
          actionLabel="Find Technical Roles"
          onAction={() => window.location.assign('/jobs')}
        />
      ) : (
        <div className="space-y-4">
          {filteredApps.map((app) => {
            const isExpanded = expandedAppId === app.id;
            return (
              <div
                key={app.id}
                className="p-6 rounded-2xl glass-panel glass-hover space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        {app.jobTitle}
                      </h2>
                      <Link
                        to={`/jobs/${app.jobId}`}
                        className="text-slate-400 hover:text-blue-600 transition-colors"
                        title="View job listing"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-700">{app.companyName}</span>
                      <span>·</span>
                      <span>Submitted on {formatDate(app.appliedDate)}</span>
                      <span>·</span>
                      <span className="font-mono text-slate-400">Ref #{app.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <ApplicationStageBadge stage={app.status} />
                    <button
                      onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors text-xs flex items-center gap-1"
                    >
                      <span>{isExpanded ? 'Less' : 'Details'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Visual Pipeline Progression Steps */}
                <div className="pt-2">
                  <div className="grid grid-cols-4 gap-2">
                    {[...APPLICATION_STATUSES].map((stepLabel, idx) => {
                      const stageIdx = APPLICATION_STATUSES.indexOf(app.status);
                      const isComplete = stageIdx >= idx;
                      const isCurrent = stageIdx === idx;
                      const isRejected = app.status === 'Rejected';

                      let barColor = 'bg-slate-200';
                      if (isRejected) {
                        barColor = 'bg-rose-50 border border-rose-200 text-rose-500';
                      } else if (isComplete) {
                        barColor = 'bg-gradient-to-r from-blue-600 to-blue-500';
                      }

                      return (
                        <div key={stepLabel} className="space-y-1.5">
                          <div className={`h-2 rounded-full ${barColor}`} />
                          <div className="flex justify-between items-center text-[11px]">
                            <span className={`font-medium ${isCurrent ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                              {stepLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recruiter Feedback / Notes Banner */}
                {app.notes && (
                  <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200/70 text-xs text-slate-600 flex items-start gap-2.5">
                    <MessageSquare className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                        Latest Communication from Recruiter
                      </div>
                      <p className="leading-relaxed">{app.notes}</p>
                    </div>
                  </div>
                )}

                {/* Expandable Dossier (Cover Letter & Resume info) */}
                {isExpanded && (
                  <div className="pt-4 border-t border-slate-200/70 space-y-3 text-xs text-slate-600 animate-in fade-in duration-100">
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-1">Attached Resume</h4>
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200 text-slate-600">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>{app.resumeFileName}</span>
                        <span className="text-slate-400 font-mono">({app.resumeSize})</span>
                      </div>
                    </div>

                    {app.coverLetter && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-1">Submitted Cover Letter</h4>
                        <p className="p-3 rounded-xl bg-white/80 border border-slate-200 text-slate-600 leading-relaxed whitespace-pre-line">
                          {app.coverLetter}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
