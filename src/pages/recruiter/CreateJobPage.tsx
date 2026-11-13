import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Job, WorkplaceType, JobType, ExperienceLevel, JobStatus } from '../../types';
import { jobService } from '../../services/api';
import { Button } from '../../components/common/Button';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { Plus, Trash2, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export const CreateJobPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [location, setLocation] = useState('San Francisco, CA');
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType>('Remote');
  const [jobType, setJobType] = useState<JobType>('Full-time');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('Senior');
  const [salaryMin, setSalaryMin] = useState(175000);
  const [salaryMax, setSalaryMax] = useState(225000);
  const [salaryCurrency, setSalaryCurrency] = useState('USD');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [responsibilities, setResponsibilities] = useState<string[]>([
    'Lead frontend architectural decisions and code reviews.',
    'Collaborate with product and backend teams on API contracts.',
  ]);
  const [newResp, setNewResp] = useState('');

  const [requirements, setRequirements] = useState<string[]>([
    '5+ years professional experience with React and TypeScript.',
    'Experience scaling web applications to thousands of concurrent users.',
  ]);
  const [newReq, setNewReq] = useState('');

  const [benefits, setBenefits] = useState<string[]>([
    'Comprehensive healthcare and dental coverage',
    'Generous equity compensation package',
    '$3,500 annual home office setup and learning stipend',
  ]);
  const [newBenefit, setNewBenefit] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddResp = () => {
    if (!newResp.trim()) return;
    setResponsibilities([...responsibilities, newResp.trim()]);
    setNewResp('');
  };

  const handleAddReq = () => {
    if (!newReq.trim()) return;
    setRequirements([...requirements, newReq.trim()]);
    setNewReq('');
  };

  const handleAddBenefit = () => {
    if (!newBenefit.trim()) return;
    setBenefits([...benefits, newBenefit.trim()]);
    setNewBenefit('');
  };

  const handleSubmit = async (status: JobStatus) => {
    if (!title.trim() || !description.trim()) {
      setErrorMessage('Please provide both a position title and a detailed job description.');
      return;
    }
    setErrorMessage(null);

    setIsSubmitting(true);
    try {
      const companyId = user?.companyId;
if (!companyId) {
  return (
    <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
      <NoticeBanner
        badge="No Company Assignment"
        message="Please complete your company profile to create jobs. Contact your administrator if this is incorrect."
      />
    </div>
  );
}
      await jobService.createJob({
        title,
        companyId,
        companyName: 'CloudScale Labs',
        companyLogo: 'comp-1',
        location,
        workplaceType,
        jobType,
        experienceLevel,
        salaryMin,
        salaryMax,
        salaryCurrency,
        department,
        description,
        responsibilities,
        requirements,
        benefits,
        status,
      });

      navigate('/recruiter/jobs');
    } catch (err) {
      console.error('Failed to create job', err);
      setErrorMessage('An unexpected error occurred while saving the job requisition.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <NoticeBanner message="Sample Requisition Creator: Newly published jobs are stored in the client-side evaluation store and instantly appear on the public job board." />

      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/recruiter/jobs')}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Manage Jobs</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-xs text-rose-300 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Create New Job Opening
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Publish a new position to the HireFlow talent board.
        </p>
      </div>

      <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
        {/* Core Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
            1. Role Title & Classification
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Position Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Principal Distributed Systems Architect"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="Engineering">Engineering</option>
                <option value="AI & Research">AI & Research</option>
                <option value="Design">Design</option>
                <option value="Product">Product</option>
                <option value="Data">Data</option>
                <option value="DevOps & Security">DevOps & Security</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Workplace Environment
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
                Employment Type
              </label>
              <select
                value={jobType}
                onChange={(e) => setJobType(e.target.value as JobType)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
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
                <option value="Entry">Entry Level</option>
                <option value="Mid">Mid Level</option>
                <option value="Senior">Senior Level</option>
                <option value="Lead">Lead Level</option>
                <option value="Executive">Executive</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Location (Hub or Region)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Compensation */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
            2. Transparent Base Compensation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Minimum Annual Base (USD)
              </label>
              <input
                type="number"
                step="5000"
                value={salaryMin}
                onChange={(e) => setSalaryMin(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Maximum Annual Base (USD)
              </label>
              <input
                type="number"
                step="5000"
                value={salaryMax}
                onChange={(e) => setSalaryMax(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Overview */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
            3. Job Overview & Description
          </h2>
          <textarea
            rows={5}
            required
            placeholder="Describe the mission, technical scope, and team dynamic..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Responsibilities */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
            4. Core Responsibilities
          </h2>
          <div className="space-y-2">
            {responsibilities.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200">
                <span>{r}</span>
                <button
                  type="button"
                  onClick={() => setResponsibilities(responsibilities.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-rose-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add responsibility item..."
              value={newResp}
              onChange={(e) => setNewResp(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAddResp}>
              Add
            </Button>
          </div>
        </div>

        {/* Requirements */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
            5. Candidate Requirements
          </h2>
          <div className="space-y-2">
            {requirements.map((r, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200">
                <span>{r}</span>
                <button
                  type="button"
                  onClick={() => setRequirements(requirements.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-rose-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add requirement item..."
              value={newReq}
              onChange={(e) => setNewReq(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAddReq}>
              Add
            </Button>
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
            6. Benefits & Total Rewards
          </h2>
          <div className="space-y-2">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200">
                <span>{b}</span>
                <button
                  type="button"
                  onClick={() => setBenefits(benefits.filter((_, idx) => idx !== i))}
                  className="text-slate-400 hover:text-rose-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add benefit item..."
              value={newBenefit}
              onChange={(e) => setNewBenefit(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleAddBenefit}>
              Add
            </Button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            disabled={isSubmitting}
            onClick={() => handleSubmit('draft')}
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            onClick={() => handleSubmit('published')}
          >
            Publish Job Posting
          </Button>
        </div>
      </div>
    </div>
  );
};
