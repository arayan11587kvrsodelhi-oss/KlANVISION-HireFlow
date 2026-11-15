import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Job, Company } from '../../types';
import { jobService, companyService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatSalary, formatDate, getWorkplaceBadgeClass } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Card, CardContent } from '../../components/common/Card';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import {
  Search,
  MapPin,
  Briefcase,
  ArrowRight,
  CheckCircle2,
  Building2,
  TrendingUp,
  Shield,
  Layers,
  Sparkles,
  Compass,
  FileCheck2,
  Kanban,
  DollarSign,
  Users,
  SlidersHorizontal,
  Bookmark,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [activeTab, setActiveTab] = useState<'candidates' | 'recruiters'>('candidates');
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const { role } = useAuth();

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [allJobs, allCompanies] = await Promise.all([
          jobService.getJobs(),
          companyService.getCompanies(),
        ]);
        if (cancelled) return;
        setFeaturedJobs(allJobs.slice(0, 4));
        setCompanies(allCompanies);
        if (role === 'candidate') {
          const saved = await jobService.getSavedJobIds();
          if (!cancelled) setSavedJobIds(saved);
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to load the job board', err);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('query', searchQuery.trim());
    if (searchLocation.trim()) params.set('location', searchLocation.trim());
    navigate(`/jobs?${params.toString()}`);
  };

  const handleToggleSave = async (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (role !== 'candidate') {
      // Saving is a candidate action; sending a visitor to sign in is clearer
      // than a silent failure.
      navigate(`/login?redirect=${encodeURIComponent('/jobs')}`);
      return;
    }
    try {
      const saved = await jobService.toggleSaveJob(jobId);
      setSavedJobIds((prev) =>
        saved ? [...prev, jobId] : prev.filter((id) => id !== jobId)
      );
    } catch (err) {
      console.error('Failed to update bookmark', err);
    }
  };

  const popularSearches = [
    'Frontend Developer',
    'React Developer',
    'Python Developer',
    'Full Stack Developer',
    'Software Engineer',
  ];

  return (
    <div className="space-y-20 pb-20 relative">
      {/* Hero Section */}
      <section className="relative pt-8 md:pt-16 px-6 max-w-7xl mx-auto space-y-8">
        {/* Platform notice banner */}
        <NoticeBanner
          badge="HireFlow"
          message="Browse live openings, apply with your profile and resume, and track every stage from screening to offer."
        />

        <div className="text-center max-w-3xl mx-auto space-y-6 pt-2">
          {/* Top category label */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 backdrop-blur-sm border border-blue-200 text-blue-600 text-xs font-semibold shadow-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Modern Enterprise Recruitment Platform</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
            Find the Right Opportunity. Build Your Future.
          </h1>

          {/* Subtitle & Value Proposition */}
          <div className="space-y-3 max-w-2xl mx-auto">
            <p className="text-slate-600 text-base md:text-lg leading-relaxed font-medium">
              HireFlow connects job seekers with companies through a transparent, organized recruitment platform.
            </p>
            <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
              Discover opportunities, showcase your skills, apply for positions and track your applications. Employers can publish openings, discover candidates and manage their recruitment pipeline in one place.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <Link to="/jobs">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Explore Jobs
              </Button>
            </Link>
            <Link to="/recruiter">
              <Button variant="secondary" size="md" leftIcon={<Users className="w-4 h-4" />}>
                Find Talent
              </Button>
            </Link>
          </div>

          {/* Primary Search Container — glass card */}
          <div className="p-2 md:p-3 glass-panel-strong rounded-2xl max-w-3xl mx-auto mt-4 text-left">
            <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-2">
              <div className="flex items-center gap-3 px-3.5 py-2.5 flex-1 w-full bg-white/80 rounded-xl border border-slate-200/80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25 transition-all">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Job title, technical skill, or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-slate-700 placeholder-slate-400 text-xs md:text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 px-3.5 py-2.5 md:w-60 w-full bg-white/80 rounded-xl border border-slate-200/80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25 transition-all">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Location or 'Remote'..."
                  value={searchLocation}
                  onChange={(e) => setSearchLocation(e.target.value)}
                  className="w-full bg-transparent text-slate-700 placeholder-slate-400 text-xs md:text-sm focus:outline-none"
                />
              </div>

              <Button type="submit" variant="primary" size="md" className="w-full md:w-auto h-10 px-5">
                <span>Search Openings</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          </div>

          {/* Popular Searches Row */}
          <div className="flex items-center justify-center gap-2 flex-wrap text-xs text-slate-500 pt-2">
            <span className="font-semibold text-slate-600">Popular searches:</span>
            {popularSearches.map((tag, idx) => (
              <React.Fragment key={tag}>
                <button
                  type="button"
                  onClick={() => navigate(`/jobs?query=${encodeURIComponent(tag)}`)}
                  className="text-slate-600 hover:text-blue-600 transition-colors font-medium hover:underline cursor-pointer"
                >
                  {tag}
                </button>
                {idx < popularSearches.length - 1 && (
                  <span aria-hidden="true" className="text-slate-400">·</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Realistic Platform Capabilities Strip (No fabricated real-world claims) */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 p-6 glass-panel rounded-2xl">
          <div className="text-center md:border-r border-slate-200/80 p-2 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Application Flow</div>
            <div className="text-sm font-bold text-slate-900 font-mono">4-Stage Pipeline</div>
            <div className="text-[11px] text-slate-500">Applied to Offer</div>
          </div>
          <div className="text-center md:border-r border-slate-200/80 p-2 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Compensation Model</div>
            <div className="text-sm font-bold text-emerald-600 font-mono">Standardized Bands</div>
            <div className="text-[11px] text-slate-500">Disclosed on every role</div>
          </div>
          <div className="text-center md:border-r border-slate-200/80 p-2 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Workplace Types</div>
            <div className="text-sm font-bold text-slate-900 font-mono">Remote · Hybrid · On-Site</div>
            <div className="text-[11px] text-slate-500">Multi-facet filtering</div>
          </div>
          <div className="text-center p-2 space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account Security</div>
            <div className="text-sm font-bold text-blue-600 font-mono">Role-based Access</div>
            <div className="text-[11px] text-slate-500">Server-enforced permissions</div>
          </div>
        </div>
      </section>

      {/* A Better Way to Connect Talent with Opportunity Section */}
      <section className="px-6 max-w-7xl mx-auto space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
            Platform Capabilities
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            A Better Way to Connect Talent with Opportunity
          </h2>
          <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
            Designed to replace clunky legacy ATS systems with transparent, structured workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Pillar 1 */}
          <div className="p-6 rounded-2xl glass-panel glass-hover space-y-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 w-fit">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Discover Opportunities</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Search jobs by title, skills, company, location and work mode with multi-faceted filtering.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-2xl glass-panel glass-hover space-y-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 w-fit">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Track Applications</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Follow your application from submission through screening, interview and final decision in real-time.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-2xl glass-panel glass-hover space-y-3">
            <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 border border-violet-200 w-fit">
              <Kanban className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Manage Recruitment</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Employers can publish jobs, review applications and manage candidate pipelines in one place.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="p-6 rounded-2xl glass-panel glass-hover space-y-3">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 w-fit">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Transparent Listings</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              View available salary information, job requirements and employment details before applying.
            </p>
          </div>
        </div>
      </section>

      {/* Featured Openings Section */}
      <section className="px-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Open Roles
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Featured Opportunities</h2>
            <p className="text-xs text-slate-500 mt-1">
              Live listings with published compensation bands and direct application.
            </p>
          </div>
          <Link
            to="/jobs"
            className="text-xs font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1 group"
          >
            <span>View all positions</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {featuredJobs.map((job) => {
            const isSaved = savedJobIds.includes(job.id);
            return (
              <div
                key={job.id}
                className="p-5 glass-panel glass-hover rounded-2xl flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm md:text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        <Link to={`/jobs/${job.id}`}>{job.title}</Link>
                      </h3>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="text-slate-700 font-medium">{job.companyName}</span>
                        <span>·</span>
                        <span>{job.location}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${getWorkplaceBadgeClass(
                          job.workplaceType
                        )}`}
                      >
                        {job.workplaceType}
                      </span>
                      <button
                        onClick={(e) => handleToggleSave(job.id, e)}
                        className={`p-1.5 rounded-lg border transition-colors ${isSaved
                            ? 'bg-blue-50 border-blue-300 text-blue-600'
                            : 'bg-white/80 border-slate-200 text-slate-400 hover:text-slate-700'
                          }`}
                        title={isSaved ? 'Remove from saved' : 'Save job'}
                      >
                        <Bookmark className="w-3.5 h-3.5 fill-current" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {job.requirements.slice(0, 3).map((req, i) => (
                      <span
                        key={i}
                        className="text-[11px] text-slate-600 bg-white/80 border border-slate-200 px-2 py-0.5 rounded-md"
                      >
                        {req.split(' ').slice(0, 3).join(' ')}...
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-200/70 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-mono font-medium text-slate-800 tabular-nums">
                      {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                    </div>
                    <div className="text-[10px] text-slate-400">Annual Base</div>
                  </div>

                  <Link
                    to={`/jobs/${job.id}`}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-500 flex items-center gap-1"
                  >
                    <span>View Position</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dual Value Proposition Section (Interactive Tabs) */}
      <section className="px-6 max-w-7xl mx-auto">
        <div className="p-6 md:p-10 rounded-3xl glass-panel-strong space-y-6">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
              Enterprise Workflows for Candidates & Hiring Teams
            </h2>
            <p className="text-xs md:text-sm text-slate-500 leading-relaxed">
              Compare candidate discovery with employer pipeline management.
            </p>
          </div>

          {/* Segmented Tab Buttons */}
          <div className="flex items-center gap-1 p-1 bg-white/80 border border-slate-200/80 rounded-xl max-w-sm shadow-sm">
            <button
              onClick={() => setActiveTab('candidates')}
              className={`flex-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${activeTab === 'candidates'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              For Job Seekers
            </button>
            <button
              onClick={() => setActiveTab('recruiters')}
              className={`flex-1 px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${activeTab === 'recruiters'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-600/25'
                  : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              For Hiring Teams
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'candidates' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="p-5 rounded-2xl bg-white/70 border border-slate-200/70 space-y-2.5">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 w-fit">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Full Salary Transparency</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Every position outlines clear salary ranges and role specifications up front.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/70 border border-slate-200/70 space-y-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 w-fit">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Application Tracking</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Track stages from initial submission to interview scheduling and offer notices.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/70 border border-slate-200/70 space-y-2.5">
                <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 w-fit">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Profile Dossier</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Keep your technical experience, skills, and resume document organized in one place.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              <div className="p-5 rounded-2xl bg-white/70 border border-slate-200/70 space-y-2.5">
                <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 w-fit">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Stage Pipeline Kanban</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Transition candidates through screening, technical review, and offer status.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/70 border border-slate-200/70 space-y-2.5">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 w-fit">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">Job Management</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Draft, publish, and update requisitions with structured criteria.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-white/70 border border-slate-200/70 space-y-2.5">
                <div className="p-2.5 rounded-xl bg-violet-50 text-violet-600 w-fit">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">FastAPI Ready</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pre-configured typed API service layer for effortless backend connectivity.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Verified Employers Strip */}
      <section className="px-6 max-w-7xl mx-auto space-y-4">
        <div className="text-xs uppercase tracking-wider text-slate-400 text-center font-semibold">
          Hiring Teams on HireFlow
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {companies.map((comp) => (
            <div
              key={comp.id}
              className="p-4 rounded-2xl glass-panel flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-semibold text-slate-800">{comp.name}</div>
                <div className="text-[11px] text-slate-500">{comp.industry}</div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200">
                {comp.openJobsCount} Open
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
