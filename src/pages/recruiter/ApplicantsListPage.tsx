import React, { useState, useEffect } from 'react';
import { Application, ApplicationStage, APPLICATION_STATUSES, Job } from '../../types';
import { applicationService, jobService } from '../../services/api';
import { formatDate, getInitials, getStageLabel } from '../../utils/formatters';
import { ApplicationStageBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import {
  Users,
  Search,
  Filter,
  Star,
  FileText,
  Mail,
  Phone,
  Clock,
  CheckCircle2,
  Download,
  Check,
} from 'lucide-react';

export const ApplicantsListPage: React.FC = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('All');
  const [selectedStage, setSelectedStage] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Selected Applicant for Dossier Modal
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [modalStage, setModalStage] = useState<ApplicationStage>('Applied');
  const [modalNotes, setModalNotes] = useState('');
  const [modalRating, setModalRating] = useState<number>(4);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSaved, setUpdateSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const fetchApplicants = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Applicants and the job filter list are both scoped to my company.
      const [companyApps, companyJobs] = await Promise.all([
        applicationService.getRecruiterApplications(),
        jobService.getMyCompanyJobs(),
      ]);
      setApplications(companyApps);
      setJobs(companyJobs);
    } catch (err) {
      console.error('Failed to load applicants', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load the applicant pipeline.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicants();
  }, []);

  const openDossier = (app: Application) => {
    setSelectedApp(app);
    setModalStage(app.status);
    setModalNotes(app.notes || '');
    setModalRating(app.rating || 4);
    setUpdateSaved(false);
  };

  const handleUpdateStatusAndNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;

    setIsUpdating(true);
    setUpdateError(null);
    try {
      const updated = await applicationService.updateStatus(
        selectedApp.id,
        modalStage,
        modalNotes,
        modalRating
      );
      setApplications((prev) =>
        prev.map((a) => (a.id === selectedApp.id ? updated : a))
      );
      setSelectedApp(updated);
      setUpdateSaved(true);
      setTimeout(() => setUpdateSaved(false), 2000);
    } catch (err) {
      console.error('Failed to update application', err);
      const apiError = err as { message?: string };
      setUpdateError(apiError.message ?? 'Failed to save the stage change.');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredApps = applications.filter((app) => {
    if (selectedJobId !== 'All' && app.jobId !== selectedJobId) return false;
    if (selectedStage !== 'All' && app.status !== selectedStage) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = app.candidateName.toLowerCase().includes(q);
      const matchRole = app.jobTitle.toLowerCase().includes(q);
      const matchEmail = app.candidateEmail.toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchEmail) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <NoticeBanner
        badge="Applicant Pipeline Management"
        message="Review candidate dossiers, assign star ratings, and update hiring stages for your company."
      />
      {errorMessage && <NoticeBanner badge="LOAD ERROR" message={errorMessage} />}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Applicant Dossiers & Review Pipeline
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Evaluate technical backgrounds, transition candidates through hiring stages, and record team feedback.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {filteredApps.length} candidates in view
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="md:col-span-4 flex items-center gap-2.5 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search candidate name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs focus:outline-none"
          />
        </div>

        {/* Job Filter */}
        <div className="md:col-span-4">
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="All">All Job Postings</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>
        </div>

        {/* Stage Filter */}
        <div className="md:col-span-4">
          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 capitalize"
          >
            {/* Values must match the API's canonical status strings; the
                previous lowercase values were rejected by the server. */}
            <option value="All">All Pipeline Stages</option>
            {APPLICATION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {getStageLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Applicants Table */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Loading applicants...</div>
      ) : filteredApps.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No candidates match this filter"
          description="Try selecting a different job requisition or resetting your stage filter."
          actionLabel="Reset Search"
          onAction={() => {
            setSelectedJobId('All');
            setSelectedStage('All');
            setSearchQuery('');
          }}
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Candidate Name</th>
                  <th className="p-4">Applied Position</th>
                  <th className="p-4">Applied Date</th>
                  <th className="p-4">Stage</th>
                  <th className="p-4">Score</th>
                  <th className="p-4 text-right">Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredApps.map((app) => (
                  <tr
                    key={app.id}
                    onClick={() => openDossier(app)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-900/40 border border-blue-700/50 text-blue-300 font-bold flex items-center justify-center text-xs">
                          {getInitials(app.candidateName)}
                        </div>
                        <div>
                          <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                            {app.candidateName}
                          </div>
                          <div className="text-[11px] text-slate-400">{app.candidateEmail}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-slate-200 font-medium">{app.jobTitle}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-400">
                      {formatDate(app.appliedDate)}
                    </td>
                    <td className="p-4">
                      <ApplicationStageBadge stage={app.status} />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="font-mono text-slate-300 font-medium">
                          {app.rating || 4}.0
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="text-xs font-semibold text-blue-400 hover:text-blue-300">
                        View Dossier
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Applicant Details & Status Transition Modal */}
      {selectedApp && (
        <Modal
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
          title={`Candidate Dossier: ${selectedApp.candidateName}`}
          description={`Applied for ${selectedApp.jobTitle} on ${formatDate(selectedApp.appliedDate)}`}
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {/* Quick Contact & Info Strip */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Email</span>
                <span className="text-white font-medium">{selectedApp.candidateEmail}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Phone</span>
                <span className="text-white font-medium">{selectedApp.candidatePhone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Resume Document</span>
                <span className="text-blue-400 font-medium truncate block">
                  {selectedApp.resumeFileName}
                </span>
              </div>
            </div>

            {/* Candidate Cover Letter */}
            {selectedApp.coverLetter && (
              <div className="space-y-1.5 text-xs">
                <h3 className="font-semibold text-slate-300">Candidate Submission Statement</h3>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 leading-relaxed whitespace-pre-line">
                  {selectedApp.coverLetter}
                </div>
              </div>
            )}

            {/* Recruiter Evaluation & Stage Transition Form */}
            <form onSubmit={handleUpdateStatusAndNotes} className="space-y-4 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Recruitment Action & Stage Management
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stage Select */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Transition Stage
                  </label>
                  <select
                    value={modalStage}
                    onChange={(e) => setModalStage(e.target.value as ApplicationStage)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 capitalize font-medium"
                  >
                    {APPLICATION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {getStageLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Candidate Quality Score
                  </label>
                  <select
                    value={modalRating}
                    onChange={(e) => setModalRating(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value={5}>5 - Outstanding (Fast-track)</option>
                    <option value={4}>4 - Strong Hire</option>
                    <option value={3}>3 - Promising (Needs second review)</option>
                    <option value={2}>2 - Marginal</option>
                    <option value={1}>1 - Does not meet baseline</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Team Collaboration Notes & Interview Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Notes recorded here are saved to the applicant history..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {updateError && (
                <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/70 text-rose-300 text-xs">
                  {updateError}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs">
                  {updateSaved && (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                      <Check className="w-4 h-4" />
                      Status updated successfully
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedApp(null)}
                  >
                    Close
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isUpdating}
                  >
                    Save Status & Feedback
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
};
