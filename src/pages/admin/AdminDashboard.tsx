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
      <div className="p-6 md:p-8 rounded-2xl glass-panel-strong flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
            <span>Platform Governance & System Administration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Administrator Console
          </h1>
          <p className="text-xs md:text-sm text-slate-500 max-w-xl">
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
        <div className="p-5 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Candidate Accounts</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {metrics ? metrics.totalCandidates.toLocaleString() : '—'}
          </div>
          <div className="text-[11px] text-slate-500">
            Registered candidates
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Partner Organizations</span>
            <Building2 className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-violet-600 tabular-nums">
            {metrics ? metrics.totalCompanies : companies.length}
          </div>
          <div className="text-[11px] text-slate-500">Registered employers</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Job Requisitions</span>
            <Briefcase className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {metrics ? metrics.totalJobs : jobs.length}
          </div>
          <div className="text-[11px] text-slate-500">All postings incl. drafts</div>
        </div>

        <div className="p-5 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Applications</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {metrics ? metrics.activeApplications : '—'}
          </div>
          <div className="text-[11px] text-slate-500">
            {metrics ? `${metrics.hiredTotal} selected in total` : 'Excludes rejected'}
          </div>
        </div>
      </div>

      {/* Main Grid: Company Moderation & Recent Requisitions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Company Governance Overview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                Corporate Accreditation Status
              </h2>
              <p className="text-xs text-slate-500">Verified employer credentials</p>
            </div>
            <Link to="/admin/companies" className="text-xs text-blue-600 hover:text-blue-500">
              Manage All ({companies.length})
            </Link>
          </div>

          <div className="space-y-3">
            {companies.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl glass-panel flex items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-slate-900 text-xs flex items-center gap-2">
                    <span>{c.name}</span>
                    {c.verified && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {c.industry} · {c.openJobsCount} positions
                  </div>
                </div>

                <Link
                  to="/admin/companies"
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg bg-white/80 border border-slate-200"
                >
                  Configure
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Recently published requisitions */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
            <div>
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                Recently Published Requisitions
              </h2>
              <p className="text-xs text-slate-500">Latest listings across all employers</p>
            </div>
            <Link to="/admin/jobs" className="text-xs text-blue-600 hover:text-blue-500">
              Moderate all
            </Link>
          </div>

          <div className="p-5 rounded-2xl glass-panel space-y-3">
            {isLoading ? (
              [1, 2, 3].map((n) => (
                <div key={n} className="h-12 rounded-lg bg-white/70 animate-pulse" />
              ))
            ) : jobs.length === 0 ? (
              <p className="text-xs text-slate-500">
                No requisitions have been published yet. Employers appear here once they post a role.
              </p>
            ) : (
              jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/80 border border-slate-200/70"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-xs font-semibold text-slate-900 hover:text-blue-600 truncate block"
                    >
                      {job.title}
                    </Link>
                    <div className="text-[11px] text-slate-500 truncate">
                      {job.companyName} · {formatDate(job.postedDate)}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-slate-200 text-slate-500 shrink-0">
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
