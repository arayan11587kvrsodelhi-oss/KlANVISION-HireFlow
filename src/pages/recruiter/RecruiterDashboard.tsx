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
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950/40 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
            <Briefcase className="w-4 h-4" />
            <span>Employer Talent Hub · {user?.companyName ?? 'Your company'}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Recruiter Control Center
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl">
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
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Job Postings</span>
            <Briefcase className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {jobs.length}
          </div>
          <div className="text-[11px] text-slate-400">
            {new Set(jobs.map((j) => j.department).filter(Boolean)).size} departments
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Applicants</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400 tabular-nums">
            {applications.length}
          </div>
          <div className="text-[11px] text-slate-400">Active review queue</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>In Technical Interview</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {inInterview}
          </div>
          <div className="text-[11px] text-slate-400">In technical review</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Offers Extended</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {inOffer}
          </div>
          <div className="text-[11px] text-slate-400">Selected candidates</div>
        </div>
      </div>

      {/* Main Grid: Recent Applicants & Active Postings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Applicants */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Recent Applicant Submissions
              </h2>
              <p className="text-xs text-slate-400">Latest dossiers awaiting evaluation or scheduling</p>
            </div>
            <Link
              to="/recruiter/applicants"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>Manage Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Candidate</th>
                    <th className="p-3.5">Target Role</th>
                    <th className="p-3.5">Applied Date</th>
                    <th className="p-3.5">Stage</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {applications.slice(0, 5).map((app) => (
                    <tr key={app.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-[10px]">
                            {getInitials(app.candidateName)}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{app.candidateName}</div>
                            <div className="text-[11px] text-slate-400">{app.candidateEmail}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-200 font-medium truncate max-w-[180px]">
                          {app.jobTitle}
                        </div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">
                        {formatDate(app.appliedDate)}
                      </td>
                      <td className="p-3.5">
                        <ApplicationStageBadge stage={app.status} />
                      </td>
                      <td className="p-3.5 text-right">
                        <Link
                          to="/recruiter/applicants"
                          className="text-blue-400 hover:text-blue-300 font-medium"
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
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Live Requisitions
              </h2>
              <p className="text-xs text-slate-400">Positions accepting applications</p>
            </div>
            <Link to="/recruiter/jobs" className="text-xs text-blue-400 hover:text-blue-300">
              All ({jobs.length})
            </Link>
          </div>

          <div className="space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xs font-semibold text-white">{job.title}</h3>
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {job.applicantsCount} applicants
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{job.department}</span>
                  <span>{job.workplaceType}</span>
                </div>
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <Link
                    to={`/recruiter/jobs/${job.id}/edit`}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    Edit Spec
                  </Link>
                  <Link
                    to="/recruiter/applicants"
                    className="text-blue-400 hover:text-blue-300 font-semibold"
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
