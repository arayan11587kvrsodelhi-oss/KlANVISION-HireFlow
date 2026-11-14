import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminMetrics, Company, Job } from '../../types';
import { adminService, companyService, jobService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import {
  Users,
  Building2,
  Briefcase,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchAdminData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const [m, compList, jobList] = await Promise.all([
          adminService.getMetrics(),
          companyService.getCompanies(),
          jobService.getJobs(),
        ]);
        if (cancelled) return;
        setMetrics(m);
        setCompanies(compList);
        setJobs(jobList);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load admin metrics', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load platform metrics.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAdminData();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      {errorMessage && <NoticeBanner badge="LOAD ERROR" message={errorMessage} />}
      <NoticeBanner
        badge="Platform Administration"
        message="Metrics below are computed live from the HireFlow database."
      />

      {/* Top Banner */}
      <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Platform Governance & System Administration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Administrator Console
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-xl">
            Oversee company accreditations, supervise candidate directory integrity, and moderate platform job requisitions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link to="/admin/companies">
            <Button variant="secondary" size="sm">
              Review Companies
            </Button>
          </Link>
          <Link to="/admin/jobs">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Moderate Postings
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Candidate Accounts</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {metrics ? metrics.totalCandidates.toLocaleString() : '—'}
          </div>
          <div className="text-[11px] text-slate-400">
            Registered candidates
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Partner Organizations</span>
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400 tabular-nums">
            {metrics ? metrics.totalCompanies : companies.length}
          </div>
          <div className="text-[11px] text-slate-400">Registered employers</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Job Requisitions</span>
            <Briefcase className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {metrics ? metrics.totalJobs : jobs.length}
          </div>
          <div className="text-[11px] text-slate-400">All postings incl. drafts</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Applications</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {metrics ? metrics.activeApplications : '—'}
          </div>
          <div className="text-[11px] text-slate-400">
            {metrics ? `${metrics.hiredTotal} selected in total` : 'Excludes rejected'}
          </div>
        </div>
      </div>

      {/* Main Grid: Company Moderation & Recent Requisitions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Company Governance Overview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Corporate Accreditation Status
              </h2>
              <p className="text-xs text-slate-400">Verified employer credentials</p>
            </div>
            <Link to="/admin/companies" className="text-xs text-blue-400 hover:text-blue-300">
              Manage All ({companies.length})
            </Link>
          </div>

          <div className="space-y-3">
            {companies.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-white text-xs flex items-center gap-2">
                    <span>{c.name}</span>
                    {c.verified && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/50">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {c.industry} · {c.openJobsCount} positions
                  </div>
                </div>

                <Link
                  to="/admin/companies"
                  className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60"
                >
                  Configure
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Recently published requisitions */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Recently Published Requisitions
              </h2>
              <p className="text-xs text-slate-400">Latest listings across all employers</p>
            </div>
            <Link to="/admin/jobs" className="text-xs text-blue-400 hover:text-blue-300">
              Moderate all
            </Link>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            {isLoading ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="h-12 rounded-lg bg-slate-950/70 animate-pulse" />
              ))
            ) : jobs.length === 0 ? (
              <p className="text-xs text-slate-400">
                No requisitions have been published yet. Employers appear here once they post a role.
              </p>
            ) : (
              jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/60 border border-slate-800"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-xs font-semibold text-white hover:text-blue-400 truncate block"
                    >
                      {job.title}
                    </Link>
                    <div className="text-[11px] text-slate-400 truncate">
                      {job.companyName} · {formatDate(job.postedDate)}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-slate-700 text-slate-300 shrink-0">
                    {job.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
