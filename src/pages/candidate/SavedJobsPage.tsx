import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { Job } from '../../types';
import { jobService } from '../../services/api';
import { formatSalary, formatDate, getWorkplaceBadgeClass } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Bookmark, MapPin, ArrowRight, Trash2 } from 'lucide-react';

export const SavedJobsPage: React.FC = () => {
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchSaved = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // The server returns only the caller's bookmarks, already joined to jobs.
      setSavedJobs(await jobService.getSavedJobs());
    } catch (err) {
      console.error('Failed to load saved jobs', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load your saved jobs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  const handleRemove = async (jobId: string) => {
    try {
      await jobService.toggleSaveJob(jobId);
      setSavedJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to remove the bookmark.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Saved Positions & Bookmarks
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Jobs you have bookmarked for review and one-click application submission.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {savedJobs.length} bookmarked
        </span>
      </div>

      {errorMessage && <NoticeBanner badge="LOAD ERROR" message={errorMessage} />}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((n) => (
            <div key={n} className="p-6 bg-slate-900 border border-slate-800 rounded-xl animate-pulse h-32" />
          ))}
        </div>
      ) : savedJobs.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="No saved positions yet"
          description="Explore our open engineering and product roles and bookmark those matching your requirements."
          actionLabel="Explore Openings"
          onAction={() => window.location.assign('/jobs')}
        />
      ) : (
        <div className="space-y-3">
          {savedJobs.map((job) => (
            <div
              key={job.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-3">
                  <Link
                    to={`/jobs/${job.id}`}
                    className="text-base font-semibold text-white hover:text-blue-400 transition-colors"
                  >
                    {job.title}
                  </Link>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded border ${getWorkplaceBadgeClass(
                      job.workplaceType
                    )}`}
                  >
                    {job.workplaceType}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                  <span className="font-medium text-slate-200">{job.companyName}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {job.location}
                  </span>
                  <span>·</span>
                  <span>{job.jobType}</span>
                </div>

                <div className="text-xs font-mono font-medium text-emerald-400 pt-1">
                  {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                <button
                  onClick={() => handleRemove(job.id)}
                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Remove from saved"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link to={`/jobs/${job.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    View & Apply
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
