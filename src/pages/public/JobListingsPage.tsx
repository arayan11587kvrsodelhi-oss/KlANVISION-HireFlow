import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Job, WorkplaceType, JobType, ExperienceLevel } from '../../types';
import { jobService } from '../../services/api';
import { formatSalary, formatDate, getWorkplaceBadgeClass } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import {
  Search,
  MapPin,
  SlidersHorizontal,
  Bookmark,
  ArrowRight,
  RotateCcw,
  Briefcase,
  DollarSign,
  Building2,
  Calendar,
  X,
  Check,
} from 'lucide-react';

export const JobListingsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [query, setQuery] = useState(searchParams.get('query') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType | 'All'>(
    (searchParams.get('workplaceType') as WorkplaceType) || 'All'
  );
  const [jobType, setJobType] = useState<JobType | 'All'>('All');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | 'All'>('All');
  const [department, setDepartment] = useState<string>('All');
  const [salaryMin, setSalaryMin] = useState<number>(0);
  const [sort, setSort] = useState<'newest' | 'salary-high' | 'salary-low'>('newest');

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const results = await jobService.getJobs({
        query,
        location,
        workplaceType,
        jobType,
        experienceLevel,
        department,
        salaryMin,
        sort,
      });
      setJobs(results);
      const saved = await jobService.getSavedJobIds();
      setSavedJobIds(saved);
    } catch (err) {
      console.error('Failed to load jobs', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [workplaceType, jobType, experienceLevel, department, salaryMin, sort]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs();
  };

  const handleToggleSave = async (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await jobService.toggleSaveJob(jobId);
    const updated = await jobService.getSavedJobIds();
    setSavedJobIds(updated);
  };

  const handleResetFilters = () => {
    setQuery('');
    setLocation('');
    setWorkplaceType('All');
    setJobType('All');
    setExperienceLevel('All');
    setDepartment('All');
    setSalaryMin(0);
    setSort('newest');
    setSearchParams({});
    jobService.getJobs().then(setJobs);
  };

  const hasActiveFilters =
    query.trim() !== '' ||
    location.trim() !== '' ||
    workplaceType !== 'All' ||
    jobType !== 'All' ||
    experienceLevel !== 'All' ||
    department !== 'All' ||
    salaryMin > 0;

  const departments = ['All', 'Engineering', 'AI & Research', 'Design', 'Product', 'Data', 'DevOps & Security'];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <NoticeBanner
        badge="Live Requisitions Directory"
        message="Browse sample open technical roles with transparent compensation bands and direct application submission."
      />

      {/* Top Search Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 flex items-center gap-3 px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg focus-within:border-blue-500 transition-colors">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search by title, technology, or keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs md:text-sm focus:outline-none"
            />
          </div>

          <div className="md:col-span-4 flex items-center gap-3 px-3.5 py-2.5 bg-slate-950/80 border border-slate-800 rounded-lg focus-within:border-blue-500 transition-colors">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Location (e.g. San Francisco, Remote)"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs md:text-sm focus:outline-none"
            />
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <Button type="submit" variant="primary" size="md" className="w-full">
              Filter Results
            </Button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Reset all filters"
                className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-3 mt-3 border-t border-slate-800/80 text-xs">
            <span className="text-slate-400 font-medium">Active filters:</span>
            {query && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
                <span>"{query}"</span>
                <button onClick={() => { setQuery(''); }}><X className="w-3 h-3 hover:text-white" /></button>
              </span>
            )}
            {location && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 text-slate-300">
                <span>{location}</span>
                <button onClick={() => { setLocation(''); }}><X className="w-3 h-3 hover:text-white" /></button>
              </span>
            )}
            {workplaceType !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 text-slate-300">
                <span>{workplaceType}</span>
                <button onClick={() => setWorkplaceType('All')}><X className="w-3 h-3 hover:text-white" /></button>
              </span>
            )}
            {department !== 'All' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 text-slate-300">
                <span>{department}</span>
                <button onClick={() => setDepartment('All')}><X className="w-3 h-3 hover:text-white" /></button>
              </span>
            )}
            {salaryMin > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-800 text-slate-300">
                <span>Min ${salaryMin / 1000}k</span>
                <button onClick={() => setSalaryMin(0)}><X className="w-3 h-3 hover:text-white" /></button>
              </span>
            )}
            <button
              onClick={handleResetFilters}
              className="text-xs text-blue-400 hover:underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Main Grid: Sidebar Filters & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Filter Column */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-white uppercase tracking-wider">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" />
                <span>Search Refinements</span>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Workplace Type */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Workplace Environment
              </label>
              <div className="space-y-1.5 text-xs text-slate-300">
                {(['All', 'Remote', 'Hybrid', 'On-site'] as const).map((type) => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer select-none py-0.5">
                    <input
                      type="radio"
                      name="workplace"
                      checked={workplaceType === type}
                      onChange={() => setWorkplaceType(type)}
                      className="accent-blue-600 w-3.5 h-3.5"
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {departments.map((dep) => (
                  <option key={dep} value={dep}>
                    {dep}
                  </option>
                ))}
              </select>
            </div>

            {/* Experience Level */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Seniority Level
              </label>
              <div className="space-y-1.5 text-xs text-slate-300">
                {(['All', 'Entry', 'Mid', 'Senior', 'Lead'] as const).map((lvl) => (
                  <label key={lvl} className="flex items-center gap-2 cursor-pointer select-none py-0.5">
                    <input
                      type="radio"
                      name="experience"
                      checked={experienceLevel === lvl}
                      onChange={() => setExperienceLevel(lvl)}
                      className="accent-blue-600 w-3.5 h-3.5"
                    />
                    <span>{lvl}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Minimum Salary Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-300 uppercase tracking-wider">
                  Min Base Salary
                </label>
                <span className="font-mono text-emerald-400 font-semibold tabular-nums">
                  ${salaryMin > 0 ? `${salaryMin / 1000}k` : 'Any'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="220000"
                step="15000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(Number(e.target.value))}
                className="w-full accent-blue-600 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>$0</span>
                <span>$100k</span>
                <span>$220k+</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Results Stream Column */}
        <div className="lg:col-span-9 space-y-4">
          {/* Top Bar for Results Count & Sort Dropdown */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="text-xs text-slate-400 font-medium">
              Showing <span className="text-white font-semibold font-mono tabular-nums">{jobs.length}</span> positions matching criteria
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Sort by:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="newest">Most Recent</option>
                <option value="salary-high">Highest Compensation</option>
                <option value="salary-low">Lowest Compensation</option>
              </select>
            </div>
          </div>

          {/* Job Card Listing */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="p-6 bg-slate-900/40 border border-slate-800 rounded-xl animate-pulse h-36"
                />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No open positions matched your criteria"
              description="Try broadening your keywords, lowering minimum salary, or resetting workplace environment filters."
              actionLabel="Reset All Filters"
              onAction={handleResetFilters}
            />
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => {
                const isSaved = savedJobIds.includes(job.id);
                return (
                  <div
                    key={job.id}
                    className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all group relative shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Job Core Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex items-start justify-between md:justify-start gap-3">
                          <Link
                            to={`/jobs/${job.id}`}
                            className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors"
                          >
                            {job.title}
                          </Link>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getWorkplaceBadgeClass(
                              job.workplaceType
                            )}`}
                          >
                            {job.workplaceType}
                          </span>
                        </div>

                        {/* Unboxed metadata with typographic separators */}
                        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                          <span className="font-medium text-slate-200">{job.companyName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {job.location}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{job.jobType}</span>
                          <span aria-hidden="true">·</span>
                          <span>{job.experienceLevel} Level</span>
                        </div>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed pt-1">
                          {job.description}
                        </p>

                        {/* Requirement Preview Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {job.requirements.slice(0, 3).map((req, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] text-slate-300 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded"
                            >
                              {req.split(' ').slice(0, 3).join(' ')}...
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Right: Salary & Actions */}
                      <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-semibold font-mono text-emerald-400 tabular-nums">
                            {formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                          </div>
                          <div className="text-[11px] text-slate-400">Annual Base Range</div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleToggleSave(job.id, e)}
                            className={`p-2 rounded-lg border transition-colors ${
                              isSaved
                                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                                : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white'
                            }`}
                            title={isSaved ? 'Remove from saved' : 'Save job'}
                          >
                            <Bookmark className="w-4 h-4 fill-current" />
                          </button>
                          <Link to={`/jobs/${job.id}`}>
                            <Button variant="primary" size="sm">
                              <span>View Position</span>
                              <ArrowRight className="w-3.5 h-3.5 ml-1" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
