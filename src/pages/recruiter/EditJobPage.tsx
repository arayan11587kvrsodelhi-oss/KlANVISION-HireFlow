import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Job, WorkplaceType, JobType, ExperienceLevel, JobStatus } from '../../types';
import { jobService } from '../../services/api';
import { Button } from '../../components/common/Button';
import { ArrowLeft, AlertCircle } from 'lucide-react';

export const EditJobPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [location, setLocation] = useState('');
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType>('Remote');
  const [jobType, setJobType] = useState<JobType>('Full-time');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('Senior');
  const [salaryMin, setSalaryMin] = useState(0);
  const [salaryMax, setSalaryMax] = useState(0);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<JobStatus>('published');
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      setIsLoading(true);
      try {
        const found = await jobService.getJobById(id);
        if (found) {
          setJob(found);
          setTitle(found.title);
          setDepartment(found.department);
          setLocation(found.location);
          setWorkplaceType(found.workplaceType);
          setJobType(found.jobType);
          setExperienceLevel(found.experienceLevel);
          setSalaryMin(found.salaryMin);
          setSalaryMax(found.salaryMax);
          setDescription(found.description);
          setStatus(found.status);
          setResponsibilities(found.responsibilities || []);
          setRequirements(found.requirements || []);
          setBenefits(found.benefits || []);
        }
      } catch (err) {
        console.error('Failed to load job', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await jobService.updateJob(id, {
        title: title.trim(),
        department,
        location,
        workplace_type: workplaceType,
        job_type: jobType,
        experience_level: experienceLevel,
        salary_min: salaryMin,
        salary_max: salaryMax,
        description,
        status,
        responsibilities,
        requirements,
        benefits,
      });
      navigate('/recruiter/jobs');
    } catch (err) {
      console.error('Failed to update job', err);
      const apiError = err as { firstFieldError?: string; message?: string };
      setErrorMessage(apiError.firstFieldError ?? apiError.message ?? 'Failed to save the job.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading position record...</div>;
  }

  if (!job) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-white">Job not found.</p>
        <button onClick={() => navigate('/recruiter/jobs')} className="text-blue-400 text-xs">
          Return to Jobs
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/recruiter/jobs')}
        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Manage Jobs</span>
      </button>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Edit Job Opening: {job.title}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Update requirements, compensation ranges, or requisition publication status.
        </p>
      </div>

      <form onSubmit={handleSave} className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Position Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Department
            </label>
            <input
              type="text"
              required
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Publication Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as JobStatus)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 capitalize"
            >
              <option value="published">Published (Active)</option>
              <option value="draft">Draft (Private)</option>
              <option value="closed">Closed / Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Workplace Type
            </label>
            <select
              value={workplaceType}
              onChange={(e) => setWorkplaceType(e.target.value as WorkplaceType)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Seniority Level
            </label>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="Entry">Entry</option>
              <option value="Mid">Mid</option>
              <option value="Senior">Senior</option>
              <option value="Lead">Lead</option>
              <option value="Executive">Executive</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Min Salary (USD)
            </label>
            <input
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Max Salary (USD)
            </label>
            <input
              type="number"
              value={salaryMax}
              onChange={(e) => setSalaryMax(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Job Description
            </label>
            <textarea
              rows={5}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => navigate('/recruiter/jobs')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSaving}
          >
            Save Requisition Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
