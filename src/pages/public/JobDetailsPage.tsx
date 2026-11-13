import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Job, Company, CandidateProfile } from '../../types';
import { jobService, companyService, applicationService, profileService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatSalary, formatDate, getWorkplaceBadgeClass } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
  Briefcase,
  MapPin,
  Building2,
  DollarSign,
  Calendar,
  Users,
  CheckCircle2,
  Bookmark,
  Share2,
  ArrowLeft,
  UploadCloud,
  FileText,
  ShieldCheck,
  Check,
} from 'lucide-react';

export const JobDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Application Modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [selectedResumeName, setSelectedResumeName] = useState<string>('');
  const [applicationSuccess, setApplicationSuccess] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    const fetchJobData = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const foundJob = await jobService.getJobById(id);
        setJob(foundJob);
        if (foundJob) {
          const foundCompany = await companyService.getCompanyById(foundJob.companyId);
          setCompany(foundCompany);

          // Check saved status
          const savedIds = await jobService.getSavedJobIds();
          setIsSaved(savedIds.includes(foundJob.id));

          // Check if candidate already applied
          if (profile) {
            const apps = await applicationService.getCandidateApplications(profile.id);
            setAlreadyApplied(apps.some((a) => a.jobId === foundJob.id));
            if (profile.resume) {
              setSelectedResumeName(profile.resume.fileName);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load job details', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobData();
  }, [id, profile]);

  const handleToggleSave = async () => {
    if (!job) return;
    await jobService.toggleSaveJob(job.id);
    setIsSaved(!isSaved);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setIsSubmitting(true);
    try {
      // Use profile from auth or create default candidate dossier
      const candidateData: CandidateProfile = profile || {
        id: 'cand-alex',
        fullName: user?.name || 'Alex Morgan',
        headline: 'Staff Frontend Engineer',
        email: user?.email || 'alex.morgan@example.com',
        phone: '+1 (415) 555-0192',
        location: 'San Francisco, CA',
        bio: 'Senior engineer',
        website: 'https://alexmorgan.dev',
        github: 'https://github.com/alexmorgan-dev',
        linkedin: 'https://linkedin.com/in/alexmorgan-eng',
        skills: ['React', 'TypeScript'],
        experience: [],
        education: [],
        resume: {
          fileName: selectedResumeName || 'Alex_Morgan_Staff_Resume_2026.pdf',
          fileSize: '248 KB',
          uploadedAt: new Date().toISOString().split('T')[0],
        },
      };

      await applicationService.applyToJob({
        job,
        candidate: candidateData,
        coverLetter,
        resumeFileName: selectedResumeName || candidateData.resume?.fileName,
      });

      setApplicationSuccess(true);
      setAlreadyApplied(true);
    } catch (err) {
      console.error('Failed to apply', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-800 rounded" />
        <div className="h-48 bg-slate-900 rounded-xl" />
        <div className="h-96 bg-slate-900 rounded-xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Position Not Found</h2>
        <p className="text-sm text-slate-400">
          The job listing you are looking for may have been archived or removed.
        </p>
        <Link to="/jobs">
          <Button variant="secondary" size="sm">
            Back to All Positions
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          to="/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Openings</span>
        </Link>
      </div>

      {/* Hero Header Card */}
      <div className="p-6 md:p-8 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded border ${getWorkplaceBadgeClass(
                  job.workplaceType
                )}`}
              >
                {job.workplaceType}
              </span>
              <span className="text-xs text-slate-400 font-medium">{job.department}</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="text-xs text-slate-400 font-mono">Posted {formatDate(job.postedDate)}</span>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {job.title}
            </h1>

            <div className="flex items-center gap-3 text-sm text-slate-300 flex-wrap">
              <span className="font-semibold text-white">{job.companyName}</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="flex items-center gap-1 text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {job.location}
              </span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span className="text-slate-400">{job.jobType}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleShare}
              className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-800 text-slate-300 transition-colors flex items-center justify-center gap-1.5 text-xs font-medium"
              title="Share job link"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={handleToggleSave}
              className={`p-2.5 rounded-lg border transition-colors flex items-center justify-center gap-1.5 text-xs font-medium ${
                isSaved
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Bookmark className="w-4 h-4 fill-current" />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>

            {alreadyApplied ? (
              <Button variant="secondary" size="md" disabled className="bg-emerald-950/50 border-emerald-800/40 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Application Sent</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsApplyModalOpen(true)}
              >
                <span>Apply for Position</span>
              </Button>
            )}
          </div>
        </div>

        {/* Quick Spec Metrics Bar */}
        <div className="pt-6 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Base Compensation</div>
            <div className="text-sm md:text-base font-bold font-mono text-emerald-400 tabular-nums">
              {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Seniority</div>
            <div className="text-sm font-semibold text-slate-200">{job.experienceLevel} Level</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Active Applicants</div>
            <div className="text-sm font-semibold font-mono text-slate-200 tabular-nums">
              {job.applicantsCount} candidates
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Recruitment Workflow</div>
            <div className="text-sm font-semibold text-slate-200">Screening · Tech Review · Offer</div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Job Description Details */}
        <div className="lg:col-span-8 space-y-8">
          {/* Overview */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Position Overview</h2>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {job.description}
            </p>
          </section>

          {/* Responsibilities */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Core Responsibilities</h2>
            <ul className="space-y-2.5">
              {job.responsibilities.map((resp, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-300 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <span>{resp}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Requirements */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Qualifications & Experience</h2>
            <ul className="space-y-2.5">
              {job.requirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-300 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-2 shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Benefits */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white tracking-tight">Benefits & Perks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {job.benefits.map((benefit, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 flex items-start gap-2 text-xs text-slate-300"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Company Dossier Card */}
        <aside className="lg:col-span-4 space-y-6">
          {company && (
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">{company.name}</h3>
                  <div className="text-xs text-slate-400 mt-0.5">{company.industry}</div>
                </div>
                {company.verified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {company.description}
              </p>

              <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Headquarters:</span>
                  <span className="font-medium text-slate-200">{company.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Team Size:</span>
                  <span className="font-medium text-slate-200">{company.employeeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Openings:</span>
                  <span className="font-medium text-blue-400">{company.openJobsCount} positions</span>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block text-center w-full py-2 px-3 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  Visit Company Website
                </a>
              </div>
            </div>
          )}

          {/* Hiring Workflow Card */}
          <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Recruitment Process
            </h4>
            <div className="space-y-3 text-xs text-slate-400">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-[10px] text-slate-200 shrink-0">
                  1
                </span>
                <div>
                  <div className="text-slate-200 font-medium">Application & Resume Screening</div>
                  <div>Reviewed directly by technical talent partners and engineering leads.</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-[10px] text-slate-200 shrink-0">
                  2
                </span>
                <div>
                  <div className="text-slate-200 font-medium">Technical Deep Dive (45m)</div>
                  <div>Architecture, system design, or domain craft with peer engineers.</div>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-mono text-[10px] text-slate-200 shrink-0">
                  3
                </span>
                <div>
                  <div className="text-slate-200 font-medium">Offer & Onboarding Roadmap</div>
                  <div>Formal offer letter with transparent equity schedules.</div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Interactive Application Modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => {
          setIsApplyModalOpen(false);
          setApplicationSuccess(false);
        }}
        title={applicationSuccess ? 'Application Submitted!' : `Apply for ${job.title}`}
        description={
          applicationSuccess
            ? 'Your application dossier has been delivered directly to the CloudScale Labs recruitment pipeline.'
            : `${job.companyName} · ${job.location}`
        }
        maxWidth="lg"
      >
        {applicationSuccess ? (
          <div className="space-y-6 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">Application Recorded</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                You can now track your application status (Screening, Interview, Offer) under your candidate dashboard.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/candidate/applications')}
              >
                View My Applications
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsApplyModalOpen(false);
                  setApplicationSuccess(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleApplySubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  defaultValue={profile?.fullName || user?.name || 'Alex Morgan'}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  defaultValue={profile?.email || user?.email || 'alex.morgan@example.com'}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                defaultValue={profile?.phone || '+1 (415) 555-0192'}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Resume Selection / Upload */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Resume Document (PDF/DOCX)
              </label>
              <div className="p-3.5 rounded-lg border border-dashed border-slate-700 bg-slate-950/50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-slate-800 text-blue-400">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {selectedResumeName || profile?.resume?.fileName || 'Alex_Morgan_Staff_Resume_2026.pdf'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {profile?.resume?.fileSize || '248 KB'} · Active Profile Resume
                    </div>
                  </div>
                </div>
                <label className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded cursor-pointer transition-colors">
                  <span>Replace</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setSelectedResumeName(e.target.files[0].name);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Cover letter */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Note to Recruiter & Engineering Lead (Optional)
              </label>
              <textarea
                rows={4}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                placeholder="Share relevant projects, systems you've architected, or why this specific position excites you..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsApplyModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
              >
                Confirm & Submit Application
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
