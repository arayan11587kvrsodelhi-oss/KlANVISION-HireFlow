import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Application, Job, ApplicationStage } from '../../types';
import { applicationService, jobService } from '../../services/api';
import { formatDate, getInitials } from '../../utils/formatters';
import { ApplicationStageBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import {
  Briefcase,
  Users,
  CheckCircle,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  Clock,
  Filter,
  Star,
} from 'lucide-react';

export const RecruiterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadRecruiterData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        // Both endpoints are scoped server-side to the recruiter's company; the
        // browser never names a company.
        const [companyJobs, companyApps] = await Promise.all([
          jobService.getMyCompanyJobs(),
          applicationService.getRecruiterApplications(),
        ]);
        if (cancelled) return;
        setJobs(companyJobs);
        setApplications(companyApps);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load recruiter data', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load your workspace.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadRecruiterData();
    return () => {
      cancelled = true;
    };
  }, []);

  const inInterview = applications.filter((a) => a.status === 'Interview').length;
  const inOffer = applications.filter((a) => a.status === 'Selected').length;

  return (
    <div className="space-y-6">
      {errorMessage && <NoticeBanner badge="LOAD ERROR" message={errorMessage} />}
      <NoticeBanner
        badge="Employer Workspace"
        message={`Managing requisitions and applicants for ${user?.companyName ?? 'your company'}.`}
      />

      {/* Top Banner */}
      <div className="p-6 md:p-8 rounded-2xl glass-panel-strong flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-600">
            <Briefcase className="w-4 h-4" />
            <span>Employer Talent Hub · {user?.companyName ?? 'Your company'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Recruiter Control Center
          </h1>
          <p className="text-xs md:text-sm text-slate-500 max-w-xl">
            Manage your open engineering requisitions, review incoming technical dossiers, and update candidate stages.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link to="/recruiter/jobs/new">
            <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
              Post New Position
            </Button>
          </Link>
          <Link to="/recruiter/applicants">
            <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Candidate Pipeline
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Job Postings</span>
            <Briefcase className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {jobs.length}
          </div>
          <div className="text-[11px] text-slate-500">
            {new Set(jobs.map((j) => j.department).filter(Boolean)).size} departments
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Applicants</span>
            <Users className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet-600 tabular-nums">
            {applications.length}
          </div>
          <div className="text-[11px] text-slate-500">Active review queue</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>In Technical Interview</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {inInterview}
          </div>
          <div className="text-[11px] text-slate-500">In technical review</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Offers Extended</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            {inOffer}
          </div>
          <div className="text-[11px] text-slate-500">Selected candidates</div>
        </div>
      </div>

      {/* Main Grid: Recent Applicants & Active Postings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Applicants */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                Recent Applicant Submissions
              </h2>
              <p className="text-xs text-slate-500">Latest dossiers awaiting evaluation or scheduling</p>
            </div>
            <Link
              to="/recruiter/applicants"
              className="text-xs font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1"
            >
              <span>Manage Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200/70">
                  <tr>
                    <th className="p-3.5">Candidate</th>
                    <th className="p-3.5">Target Role</th>
                    <th className="p-3.5">Applied Date</th>
                    <th className="p-3.5">Stage</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {applications.slice(0, 5).map((app) => (
                    <tr key={app.id} className="hover:bg-white/80 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-[10px] shadow-sm">
                            {getInitials(app.candidateName)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{app.candidateName}</div>
                            <div className="text-[11px] text-slate-500">{app.candidateEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-700 font-medium truncate max-w-[180px]">
                          {app.jobTitle}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">
                        {formatDate(app.appliedDate)}
                      </td>
                      <td className="p-3.5">
                        <ApplicationStageBadge stage={app.status} />
                      </td>
                      <td className="p-3.5 text-right">
                        <Link
                          to="/recruiter/applicants"
                          className="text-blue-600 hover:text-blue-500 font-medium"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick Open Positions Summary */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                Live Requisitions
              </h2>
              <p className="text-xs text-slate-500">Positions accepting applications</p>
            </div>
            <Link to="/recruiter/jobs" className="text-xs text-blue-600 hover:text-blue-500">
              All ({jobs.length})
            </Link>
          </div>

          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-2xl glass-panel glass-hover space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-900">{job.title}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
                    {job.applicantsCount} applicants
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>{job.department}</span>
                  <span>{job.workplaceType}</span>
                </div>
                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs">
                  <Link
                    to={`/recruiter/jobs/${job.id}/edit`}
                    className="text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    Edit Spec
                  </Link>
                  <Link
                    to="/recruiter/applicants"
                    className="text-blue-600 hover:text-blue-500 font-semibold"
                  >
                    View Dossiers
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
