import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminMetrics, Company, Job } from '../../types';
import { adminService, companyService, jobService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import {
  ShieldAlert,
  Users,
  Building2,
  Briefcase,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Server,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      setIsLoading(true);
      try {
        const m = await adminService.getMetrics();
        setMetrics(m);
        const compList = await companyService.getCompanies();
        setCompanies(compList);
        const jobList = await jobService.getJobs();
        setJobs(jobList);
      } catch (err) {
        console.error('Failed to load admin metrics', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  return (
    <div className="space-y-6">
      <NoticeBanner message="Sample Administration Console: Platform moderation and governance actions update simulated evaluation records in memory." />

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
            <span>Sample Candidate Profiles</span>
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {metrics?.totalCandidates.toLocaleString() || '1,842'}
          </div>
          <div className="text-[11px] text-slate-400">
            Evaluation directory
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Partner Organizations</span>
            <Building2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400 tabular-nums">
            {metrics?.totalCompanies || companies.length}
          </div>
          <div className="text-[11px] text-slate-400">Accredited tech employers</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Requisitions in Moderation</span>
            <Briefcase className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {metrics?.totalJobs || jobs.length}
          </div>
          <div className="text-[11px] text-slate-400">Active postings board</div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Applications</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
            {metrics?.activeApplications || '6'}
          </div>
          <div className="text-[11px] text-slate-400">Platform throughput</div>
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

        {/* System Architecture & FastAPI Readiness */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Backend Architecture Specification
              </h2>
              <p className="text-xs text-slate-400">Ready for FastAPI REST endpoints</p>
            </div>
            <span className="text-xs font-mono text-emerald-400">Ready</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">FastAPI Service Abstraction</h3>
                <p className="text-xs text-slate-400">
                  Zero UI refactoring required to connect Python endpoints.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
              <div>GET /api/v1/jobs - Filterable query schema</div>
              <div>POST /api/v1/jobs - Employer posting payload</div>
              <div>POST /api/v1/applications - Multipart dossier upload</div>
              <div>PATCH /api/v1/applications/{'{id}'}/status - State machine</div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              HireFlow adheres to clean service contracts (`src/services/api.ts`). Replace the client method bodies with Axios or Fetch calls when your FastAPI backend is deployed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
