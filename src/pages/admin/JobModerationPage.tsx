import React, { useState, useEffect } from 'react';
import { Job, JobStatus } from '../../types';
import { jobService } from '../../services/api';
import { formatSalary, formatDate } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { Briefcase, Search, Star, Trash2, Eye, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const JobModerationPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const data = await jobService.getJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to load jobs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleStatusChange = async (jobId: string, newStatus: JobStatus) => {
    try {
      const updated = await jobService.updateJob(jobId, { status: newStatus });
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
    } catch (err) {
      console.error('Failed to change job status', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to change the job status.');
    }
  };

  const handleToggleFeatured = async (jobId: string, currentFeatured: boolean) => {
    try {
      const updated = await jobService.setFeatured(jobId, !currentFeatured);
      setJobs((prev) => prev.map((j) => (j.id === jobId ? updated : j)));
    } catch (err) {
      console.error('Failed to update featured flag', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update the featured flag.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return;
    setIsDeleting(true);
    try {
      await jobService.deleteJob(jobToDelete.id);
      setJobs((prev) => prev.filter((j) => j.id !== jobToDelete.id));
      setJobToDelete(null);
    } catch (err) {
      console.error('Failed to delete job', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete the job.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = jobs.filter(
    (j) =>
      j.title.toLowerCase().includes(query.toLowerCase()) ||
      j.companyName.toLowerCase().includes(query.toLowerCase()) ||
      j.department.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <NoticeBanner
        badge="Platform Governance"
        message="Job Moderation Console · Audit requisitions across all registered employers."
      />
      {errorMessage && <NoticeBanner badge="ERROR" message={errorMessage} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Job Requisitions & Content Moderation
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enforce compensation transparency policies, curate featured roles, and deactivate expired listings.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {jobs.length} Platform Openings
        </span>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl max-w-md">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter by title, company, or department..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs focus:outline-none"
        />
      </div>

      {/* Moderation Table */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Loading requisitions...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Requisition Title</th>
                  <th className="p-4">Employer</th>
                  <th className="p-4">Compensation</th>
                  <th className="p-4">Featured</th>
                  <th className="p-4">Status Moderation</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <Link to={`/jobs/${job.id}`} className="hover:text-blue-400 transition-colors">
                          {job.title}
                        </Link>
                        <Link to={`/jobs/${job.id}`} className="text-slate-400 hover:text-slate-300">
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {job.department} · {job.workplaceType}
                      </div>
                    </td>
                    <td className="p-4 text-slate-200 font-medium">{job.companyName}</td>
                    <td className="p-4 font-mono text-emerald-400 tabular-nums">
                      {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleFeatured(job.id, !!job.featured)}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          job.featured
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                            : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200'
                        }`}
                        title={job.featured ? 'Unfeature from home page' : 'Feature on home page'}
                      >
                        <Star className={`w-3.5 h-3.5 ${job.featured ? 'fill-current' : ''}`} />
                      </button>
                    </td>
                    <td className="p-4">
                      <select
                        value={job.status}
                        onChange={(e) => handleStatusChange(job.id, e.target.value as JobStatus)}
                        className={`text-xs px-2.5 py-1 rounded-md border capitalize font-medium bg-slate-950 focus:outline-none cursor-pointer ${
                          job.status === 'published'
                            ? 'text-emerald-400 border-emerald-800/60'
                            : job.status === 'draft'
                            ? 'text-amber-400 border-amber-800/60'
                            : 'text-rose-400 border-rose-800/60'
                        }`}
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/jobs/${job.id}`}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                          title="View public page"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => setJobToDelete(job)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          title="Remove listing"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!jobToDelete}
        onClose={() => setJobToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Requisition from Platform"
        description={`Are you sure you want to remove "${jobToDelete?.title}" from the platform? This will deactivate the listing immediately.`}
        confirmLabel="Deactivate & Remove"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
