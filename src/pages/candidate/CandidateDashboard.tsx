import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Application, Job } from '../../types';
import { applicationService, jobService } from '../../services/api';
import { formatSalary, formatDate } from '../../utils/formatters';
import { ApplicationStageBadge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/common/Card';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import {
  Send,
  CalendarCheck,
  Bookmark,
  Sparkles,
  ArrowRight,
  Clock,
  Building2,
  FileText,
  UserCheck,
  CheckCircle2,
  Check,
  Sliders,
  ChevronRight,
} from 'lucide-react';

export const CandidateDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadDashboardData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        // The API resolves the candidate from the access token, so no id is
        // passed from the browser.
        const [apps, allJobs, savedIds] = await Promise.all([
          applicationService.getCandidateApplications(),
          jobService.getJobs(),
          jobService.getSavedJobIds(),
        ]);
        if (cancelled) return;
        setApplications(apps);
        setRecommendedJobs(allJobs.slice(0, 3));
        setSavedJobs(allJobs.filter((j) => savedIds.includes(j.id)).slice(0, 3));
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load candidate dashboard', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load your dashboard.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeInterviews = applications.filter((a) => a.status === 'Interview');
  const inScreening = applications.filter((a) => a.status === 'Shortlisted');
  const activeCount = applications.filter((a) => a.status !== 'Rejected').length;

  // Calculate profile completeness score
  const hasBasicInfo = !!(profile?.fullName && profile?.headline && profile?.email);
  const hasSkills = !!(profile?.skills && profile.skills.length >= 3);
  const hasExperience = !!(profile?.experience && profile.experience.length >= 1);
  const hasResume = !!profile?.resume?.fileName;

  const completionChecks = [
    { title: 'Personal info & headline', complete: hasBasicInfo, link: '/candidate/profile' },
    { title: `Technical competencies (${profile?.skills?.length || 0} skills)`, complete: hasSkills, link: '/candidate/skills' },
    { title: `Employment history (${profile?.experience?.length || 0} roles)`, complete: hasExperience, link: '/candidate/skills' },
    { title: 'Primary resume document attached', complete: hasResume, link: '/candidate/resume' },
  ];

  const completedCount = completionChecks.filter((c) => c.complete).length;
  const completionPercentage = Math.round((completedCount / completionChecks.length) * 100);

  return (
    <div className="space-y-6">
    {errorMessage && (
        <NoticeBanner badge="LOAD ERROR" message={errorMessage} />
    )}
    <NoticeBanner
        badge="Candidate Workspace"
        message={
        profile?.fullName
          ? `Reviewing your dossier, ${profile.fullName} · synchronized with live recruitment pipelines.`
          : 'Complete your profile so recruiters can review your dossier.'
        }
      />

      {/* Top Welcome Banner */}
      <div className="p-6 md:p-8 rounded-2xl glass-panel-strong flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
            <UserCheck className="w-4 h-4" />
            <span>Candidate Dossier & Sourcing Stream</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Welcome back, {profile?.fullName || 'Candidate'}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 max-w-xl">
            {profile?.headline || 'Add a professional headline to stand out'}
            {profile?.location ? ` · ${profile.location}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link to="/candidate/resume">
            <Button variant="secondary" size="sm" leftIcon={<FileText className="w-3.5 h-3.5" />}>
              Resume Center
            </Button>
          </Link>
          <Link to="/jobs">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Find Open Positions
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Submitted Applications</span>
            <Send className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {applications.length}
          </div>
          <div className="text-[11px] text-slate-500">
            {activeCount} active in review
          </div>
        </div>

        <div className="p-4 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Interview Round</span>
            <CalendarCheck className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {activeInterviews.length}
          </div>
          <div className="text-[11px] text-slate-500">Technical review stage</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Bookmarked Roles</span>
            <Bookmark className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {savedJobs.length}
          </div>
          <div className="text-[11px] text-slate-500">Saved for review</div>
        </div>

        <div className="p-4 rounded-2xl glass-panel glass-hover space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Profile Health</span>
            <Sparkles className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            {completionPercentage}%
          </div>
          <div className="text-[11px] text-slate-500">{completedCount} of 4 areas ready</div>
        </div>
      </div>

      {/* Main Grid: Application Tracking & Profile Completion / Saved */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Applications Pipeline */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight uppercase tracking-wider">
                Application Pipeline Status
              </h2>
              <p className="text-xs text-slate-500">Real-time stage transparency from verified hiring managers</p>
            </div>
            <Link
              to="/candidate/applications"
              className="text-xs font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1"
            >
              <span>View all ({applications.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="p-5 rounded-2xl glass-panel glass-hover space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{app.jobTitle}</h3>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="text-slate-700 font-medium">{app.companyName}</span>
                      <span>·</span>
                      <span>Submitted on {formatDate(app.appliedDate)}</span>
                    </div>
                  </div>
                  <ApplicationStageBadge stage={app.status} />
                </div>

                {/* Visual Pipeline Progression Steps */}
                <div className="pt-1">
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { key: 'applied', label: '1. Applied' },
                      { key: 'screening', label: '2. Screening' },
                      { key: 'interview', label: '3. Interview' },
                      { key: 'offer', label: '4. Decision' },
                    ].map((step, idx) => {
                      const stages = ['applied', 'screening', 'interview', 'offer'];
                      const currentIdx = stages.indexOf(app.status);
                      const isComplete = currentIdx >= idx;
                      const isCurrent = currentIdx === idx;
                      const isRejected = app.status === 'Rejected';

                      let barColor = 'bg-slate-200';
                      if (isRejected) {
                        barColor = 'bg-rose-50 border border-rose-200 text-rose-500';
                      } else if (isComplete) {
                        barColor = 'bg-gradient-to-r from-blue-600 to-blue-500';
                      }

                      return (
                        <div key={step.key} className="space-y-1">
                          <div className={`h-1.5 rounded-full ${barColor}`} />
                          <div className={`text-[10px] truncate ${isCurrent ? 'text-blue-600 font-semibold' : 'text-slate-500'}`}>
                            {step.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {app.notes && (
                  <div className="p-3 rounded-xl bg-white/80 border border-slate-200/70 text-xs text-slate-600 flex items-start gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-700">Recruiter Feedback: </span>
                      <span>{app.notes}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Profile Completion & Saved Jobs */}
        <div className="lg:col-span-4 space-y-6">
          {/* Profile Completion Checklist */}
          <div className="p-5 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <div className="space-y-0.5">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Profile Completion
                </h3>
                <p className="text-[11px] text-slate-500">Dossier visibility to recruiters</p>
              </div>
              <span className="font-mono font-bold text-xs text-emerald-600">
                {completionPercentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/70">
              <div
                className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            <div className="space-y-2 pt-1 text-xs">
              {completionChecks.map((item, idx) => (
                <Link
                  key={idx}
                  to={item.link}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-white/90 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                        item.complete
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" />
                    </div>
                    <span className="text-slate-600 text-xs group-hover:text-slate-900 transition-colors">
                      {item.title}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* Saved Jobs Mini-List */}
          <div className="p-5 rounded-2xl glass-panel space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Bookmarked Roles
              </h3>
              <Link to="/candidate/saved" className="text-xs text-blue-600 hover:text-blue-500">
                View all ({savedJobs.length})
              </Link>
            </div>

            <div className="space-y-2">
              {savedJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-xl bg-white/80 border border-slate-200/70 hover:border-slate-300 transition-colors space-y-1"
                >
                  <div className="flex items-start justify-between gap-1">
                    <Link
                      to={`/jobs/${job.id}`}
                      className="text-xs font-semibold text-slate-900 hover:text-blue-600 transition-colors truncate"
                    >
                      {job.title}
                    </Link>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>{job.companyName}</span>
                    <span className="font-mono text-emerald-600">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
