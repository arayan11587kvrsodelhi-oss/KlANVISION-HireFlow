import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Application, ApplicationStatus, APPLICATION_STATUSES } from '../../types';
import { applicationService } from '../../services/api';
import { formatDate, formatDateTime, formatShortRef } from '../../utils/formatters';
import { ApplicationStageBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Send,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  MessageSquareOff,
  CheckCircle2,
  Circle,
  XCircle,
} from 'lucide-react';

/**
 * The visible recruitment pipeline shown to candidates.
 *
 * "Screening" and "Shortlisted" both map onto the canonical `Shortlisted`
 * status (resume screening IS the shortlisting step), so the seven-step
 * hiring journey the recruiters describe maps cleanly onto the five stored
 * statuses without inventing data. "Rejected" is a terminal branch shown
 * separately when the application is rejected.
 */
const PIPELINE_STAGES: Array<{ label: string; status: ApplicationStatus }> = [
  { label: 'Applied', status: 'Applied' },
  { label: 'Screening', status: 'Shortlisted' },
  { label: 'Shortlisted', status: 'Shortlisted' },
  { label: 'Interview', status: 'Interview' },
  { label: 'Selected', status: 'Selected' },
];

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
                      <span className="font-mono text-slate-400">Ref {formatShortRef(app.id)}</span>
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
                  <div className="grid grid-cols-5 gap-2">
                    {(() => {
                      const currentStageIdx = PIPELINE_STAGES.reduce(
                        (acc, s, i) => (s.status === app.status ? i : acc),
                        0
                      );
                      const isRejected = app.status === 'Rejected';
                      return PIPELINE_STAGES.map((stage, idx) => {
                        const isComplete = idx < currentStageIdx;
                        const isCurrent = idx === currentStageIdx && !isRejected;
                        const isUpcoming = idx > currentStageIdx && !isRejected;

                        const barColor = isRejected
                          ? 'bg-rose-200'
                          : isCurrent
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 ring-2 ring-blue-500/30'
                          : isComplete
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : 'bg-slate-200';

                        const labelColor = isRejected
                          ? 'text-rose-500'
                          : isCurrent
                          ? 'text-blue-600 font-bold'
                          : isComplete
                          ? 'text-emerald-600'
                          : isUpcoming
                          ? 'text-slate-400'
                          : 'text-slate-500';

                        return (
                          <div key={stage.label} className="space-y-1.5">
                            <div className="flex items-center gap-1">
                              {isComplete ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              ) : isCurrent ? (
                                <Circle className="w-3.5 h-3.5 text-blue-600 fill-blue-100 shrink-0" />
                              ) : isRejected && idx === currentStageIdx ? (
                                <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                              )}
                              <span className={`text-[11px] font-medium ${labelColor}`}>
                                {stage.label}
                              </span>
                            </div>
                            <div className={`h-1.5 rounded-full ${barColor}`} />
                          </div>
                        );
                      });
                    })()}
                  </div>
                  {app.status === 'Rejected' && (
                    <p className="text-[11px] text-rose-500 mt-2 font-medium">
                      This application was not selected. The pipeline above is paused at its last
                      active stage.
                    </p>
                  )}
                </div>

                {/* Recruiter Feedback / Notes Banner */}
                {app.notes ? (
                  <div className="p-3.5 rounded-xl bg-white/80 border border-slate-200/70 text-xs text-slate-600 flex items-start gap-2.5">
                    <MessageSquare className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                        Latest Communication from Recruiter
                      </div>
                      <p className="leading-relaxed">{app.notes}</p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="p-3 rounded-xl bg-white/50 border border-dashed border-slate-200 text-xs text-slate-400 flex items-center gap-2"
                    aria-live="polite"
                  >
                    <MessageSquareOff className="w-4 h-4 text-slate-300 shrink-0" />
                    <span>
                      No recruiter feedback yet — you will see it here as soon as the hiring team
                      updates your application.
                    </span>
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

                    {/* Status-change audit trail, straight from the API. */}
                    <div>
                      <h4 className="font-semibold text-slate-700 mb-1">Status History</h4>
                      {app.history?.length ? (
                        <ul className="space-y-1.5">
                          {[...app.history]
                            .sort((a, b) => Date.parse(a.changed_at) - Date.parse(b.changed_at))
                            .map((h, i) => (
                              <li
                                key={`${h.changed_at}-${i}`}
                                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 px-3 py-1.5 rounded-xl bg-white/80 border border-slate-200 text-slate-600"
                              >
                                <span className="whitespace-nowrap">
                                  {h.previous_status === h.new_status
                                    ? `Application submitted (${h.new_status})`
                                    : `${h.previous_status} → ${h.new_status}`}
                                </span>
                                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                                  {formatDateTime(h.changed_at)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-slate-400 px-1">No recorded stage changes yet.</p>
                      )}
                    </div>
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
