import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { Job, JobStatus } from '../../types';
import { jobService } from '../../services/api';
import { formatSalary, formatDate, getWorkplaceBadgeClass } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import {
  Briefcase,
  PlusCircle,
  Search,
  Edit,
  Users,
  Trash2,
  CheckCircle2,
  Eye,
} from 'lucide-react';

export const ManageJobsPage: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const companyId = user?.companyId;
if (!companyId) {
  return (
    <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
      <NoticeBanner
        badge="No Company Assignment"
        message="Please complete your company profile to manage jobs. Contact your administrator if this is incorrect."
      />
    </div>
  );
}
      const allJobs = await jobService.getJobs({ includeAll: true });
      setJobs(allJobs.filter((j) => j.companyId === companyId));
    } catch (err) {
      console.error('Failed to load jobs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  const handleToggleStatus = async (jobId: string, currentStatus: JobStatus) => {
    const newStatus: JobStatus = currentStatus === 'published' ? 'closed' : 'published';
    await jobService.updateJob(jobId, { status: newStatus });
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
    );
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
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredJobs = jobs.filter((j) =>
    j.title.toLowerCase().includes(query.toLowerCase()) ||
    j.department.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <NoticeBanner
        badge="Recruiter Workspace"
        message="Job Management Console · Manage requisitions for CloudScale Labs."
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Job Requisitions & Active Postings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Publish, edit, and track active positions open for candidate submissions.
          </p>
        </div>

        <Link to="/recruiter/jobs/new">
          <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
            Post New Job
          </Button>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl max-w-md">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter by role title or department..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs focus:outline-none"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Loading requisitions...</div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No job openings found"
          description="Create your first job posting to start receiving qualified applicant dossiers."
          actionLabel="Post New Job"
          onAction={() => navigate('/recruiter/jobs/new')}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Position Title</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Workplace</th>
                  <th className="p-4">Compensation Range</th>
                  <th className="p-4">Applicants</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4 font-semibold text-white">
                      <Link to={`/jobs/${job.id}`} className="hover:text-blue-400 transition-colors">
                        {job.title}
                      </Link>
                      <div className="text-[11px] text-slate-400 font-normal">
                        Posted on {formatDate(job.postedDate)}
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">{job.department}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getWorkplaceBadgeClass(job.workplaceType)}`}>
                        {job.workplaceType}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-medium text-slate-200 tabular-nums">
                      {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                    </td>
                    <td className="p-4 font-mono">
                      <Link
                        to="/recruiter/applicants"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold hover:bg-blue-500/20 transition-colors"
                      >
                        <Users className="w-3 h-3" />
                        <span>{job.applicantsCount}</span>
                      </Link>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleStatus(job.id, job.status)}
                        className={`text-[11px] font-medium px-2.5 py-0.5 rounded border capitalize transition-colors cursor-pointer ${
                          job.status === 'published'
                            ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title="Click to toggle publication status"
                      >
                        {job.status}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/recruiter/jobs/${job.id}/edit`}
                          className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
                          title="Edit Position"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => setJobToDelete(job)}
                          className="p-1.5 rounded-lg border border-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete Position"
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

      {/* Accessible Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!jobToDelete}
        onClose={() => setJobToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Job Requisition"
        description={`Are you sure you want to delete "${jobToDelete?.title}"? This will remove the posting from the public board and archive related applicant records.`}
        confirmLabel="Delete Requisition"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
