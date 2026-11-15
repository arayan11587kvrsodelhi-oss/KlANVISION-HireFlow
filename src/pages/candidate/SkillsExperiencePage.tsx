import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { profileService } from '../../services/api';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { formatDate } from '../../utils/formatters';
import {
  GraduationCap,
  Briefcase,
  Plus,
  Trash2,
  Calendar,
  Building,
  CheckCircle2,
  X,
} from 'lucide-react';

export const SkillsExperiencePage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();

  // Skills state (seeded from the server, kept in sync after each save).
  const [skills, setSkills] = useState<string[]>(profile?.skills || []);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSkills(profile?.skills || []);
  }, [profile?.skills]);

  const handleError = (err: unknown, fallback: string) => {
    const apiError = err as { firstFieldError?: string; message?: string };
    setErrorMessage(apiError.firstFieldError ?? apiError.message ?? fallback);
  };

  // Experience modal state
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [expRole, setExpRole] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expLocation, setExpLocation] = useState('');
  const [expStartDate, setExpStartDate] = useState('');
  const [expEndDate, setExpEndDate] = useState('');
  const [expCurrent, setExpCurrent] = useState(false);
  const [expDescription, setExpDescription] = useState('');

  // Education modal state
  const [isEduModalOpen, setIsEduModalOpen] = useState(false);
  const [eduDegree, setEduDegree] = useState('');
  const [eduField, setEduField] = useState('');
  const [eduInstitution, setEduInstitution] = useState('');
  const [eduStartYear, setEduStartYear] = useState('');
  const [eduEndYear, setEduEndYear] = useState('');
  const [eduGpa, setEduGpa] = useState('');

  // Add / Remove Skill
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    if (skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setNewSkillInput('');
      return;
    }
    setErrorMessage(null);
    setIsSaving(true);
    try {
      const updated = await profileService.replaceSkills([...skills, trimmed]);
      setSkills(updated.skills);
      setNewSkillInput('');
      await refreshProfile();
    } catch (err) {
      handleError(err, 'Failed to save skill.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    setErrorMessage(null);
    try {
      const updated = await profileService.replaceSkills(skills.filter((s) => s !== skillToRemove));
      setSkills(updated.skills);
      await refreshProfile();
    } catch (err) {
      handleError(err, 'Failed to remove skill.');
    }
  };

  // Add Experience
  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await profileService.addExperience({
        role: expRole,
        company: expCompany,
        location: expLocation,
        startDate: expStartDate,
        endDate: expCurrent ? '' : expEndDate,
        current: expCurrent,
        description: expDescription,
      });
      await refreshProfile();

      setIsExpModalOpen(false);
      setExpRole('');
      setExpCompany('');
      setExpLocation('');
      setExpStartDate('');
      setExpEndDate('');
      setExpCurrent(false);
      setExpDescription('');
    } catch (err) {
      handleError(err, 'Failed to save experience entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    setErrorMessage(null);
    try {
      await profileService.deleteExperience(id);
      await refreshProfile();
    } catch (err) {
      handleError(err, 'Failed to delete experience entry.');
    }
  };

  // Add Education
  const handleSaveEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);
    try {
      await profileService.addEducation({
        degree: eduDegree,
        field: eduField,
        institution: eduInstitution,
        startYear: eduStartYear,
        endYear: eduEndYear,
        gpa: eduGpa,
      });
      await refreshProfile();

      setIsEduModalOpen(false);
      setEduDegree('');
      setEduField('');
      setEduInstitution('');
      setEduStartYear('');
      setEduEndYear('');
      setEduGpa('');
    } catch (err) {
      handleError(err, 'Failed to save education entry.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEducation = async (id: string) => {
    setErrorMessage(null);
    try {
      await profileService.deleteEducation(id);
      await refreshProfile();
    } catch (err) {
      handleError(err, 'Failed to delete education entry.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {errorMessage && <NoticeBanner badge="SAVE ERROR" message={errorMessage} />}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          Skills, Experience & Education
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Detailed technical history parsed by hiring managers and recruiter algorithms.
        </p>
      </div>

      {/* 1. Skills Manager */}
      <section className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Technical Skills & Competencies</h2>
            <p className="text-xs text-slate-500">Add programming languages, frameworks, and architecture tools</p>
          </div>
          <span className="text-xs font-mono text-slate-500">{skills.length} skills listed</span>
        </div>

        {/* Input bar */}
        <form onSubmit={handleAddSkill} className="flex gap-2 max-w-md">
          <input
            type="text"
            placeholder="Add skill (e.g. Distributed Systems, Rust, GraphQL)..."
            value={newSkillInput}
            onChange={(e) => setNewSkillInput(e.target.value)}
            className="flex-1 bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSaving}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add
          </Button>
        </form>

        {/* Interactive Skills Badges (with delete) */}
        <div className="flex flex-wrap gap-2 pt-2">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-sm"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => handleRemoveSkill(skill)}
                className="text-slate-400 hover:text-rose-500 p-0.5 rounded transition-colors"
                title={`Remove ${skill}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      </section>

      {/* 2. Work Experience */}
      <section className="p-6 rounded-2xl glass-panel space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Work Experience</h2>
            <p className="text-xs text-slate-500">Previous and current employment records</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsExpModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Experience
          </Button>
        </div>

        <div className="space-y-4">
          {(profile?.experience || []).map((exp) => (
            <div
              key={exp.id}
              className="p-4 rounded-xl bg-white/80 border border-slate-200/70 space-y-2 relative group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{exp.role}</h3>
                  <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                    <span className="text-blue-600 font-medium">{exp.company}</span>
                    <span>·</span>
                    <span>{exp.location}</span>
                    <span>·</span>
                    <span className="font-mono text-slate-300">
                      {formatDate(exp.startDate)} - {exp.current ? 'Present' : formatDate(exp.endDate)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteExperience(exp.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                  title="Delete experience"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed pt-1 whitespace-pre-line">
                {exp.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Education History */}
      <section className="p-6 rounded-2xl glass-panel space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Education & Degrees</h2>
            <p className="text-xs text-slate-500">Academic foundations and certifications</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEduModalOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Education
          </Button>
        </div>

        <div className="space-y-3">
          {(profile?.education || []).map((edu) => (
            <div
              key={edu.id}
              className="p-4 rounded-xl bg-white/80 border border-slate-200/70 flex items-start justify-between relative group"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-900">{edu.degree}</h3>
                <div className="text-xs text-slate-600 mt-0.5">{edu.field}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span className="text-slate-800">{edu.institution}</span>
                  <span>·</span>
                  <span className="font-mono">{edu.startYear} - {edu.endYear}</span>
                  {edu.gpa && (
                    <>
                      <span>·</span>
                      <span>GPA: {edu.gpa}</span>
                    </>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleDeleteEducation(edu.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded transition-all"
                title="Delete education"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Modal: Add Work Experience */}
      <Modal
        isOpen={isExpModalOpen}
        onClose={() => setIsExpModalOpen(false)}
        title="Add Work Experience"
        description="Share your title, engineering accomplishments, and tech stack."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveExperience} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Job Title / Role
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Lead Staff Frontend Engineer"
                value={expRole}
                onChange={(e) => setExpRole(e.target.value)}
                className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Company Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Stripe, Inc."
                value={expCompany}
                onChange={(e) => setExpCompany(e.target.value)}
                className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Location
            </label>
            <input
              type="text"
              placeholder="e.g. San Francisco, CA (Remote)"
              value={expLocation}
              onChange={(e) => setExpLocation(e.target.value)}
              className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Start Date
              </label>
              <input
                type="month"
                required
                value={expStartDate}
                onChange={(e) => setExpStartDate(e.target.value)}
                className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                End Date
              </label>
              <input
                type="month"
                disabled={expCurrent}
                value={expEndDate}
                onChange={(e) => setExpEndDate(e.target.value)}
                className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 disabled:opacity-40"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1 text-xs text-slate-600">
            <input
              type="checkbox"
              id="currentRole"
              checked={expCurrent}
              onChange={(e) => setExpCurrent(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <label htmlFor="currentRole" className="cursor-pointer select-none">
              I currently work in this role
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Key Responsibilities & Impact
            </label>
            <textarea
              rows={4}
              required
              placeholder="Architected distributed cache invalidation reducing p99 response times by 35%..."
              value={expDescription}
              onChange={(e) => setExpDescription(e.target.value)}
              className="w-full bg-white/80 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200/70">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsExpModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Entry
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Education */}
      <Modal
        isOpen={isEduModalOpen}
        onClose={() => setIsEduModalOpen(false)}
        title="Add Education & Degree"
        description="Add university degrees or verified technical academies."
        maxWidth="md"
      >
        <form onSubmit={handleSaveEducation} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Degree / Credential
            </label>
            <input
              type="text"
              required
              placeholder="e.g. B.S. in Computer Science"
              value={eduDegree}
              onChange={(e) => setEduDegree(e.target.value)}
              className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Field of Study
            </label>
            <input
              type="text"
              placeholder="e.g. Software Engineering & Distributed Systems"
              value={eduField}
              onChange={(e) => setEduField(e.target.value)}
              className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Institution / University
            </label>
            <input
              type="text"
              required
              placeholder="e.g. University of Washington"
              value={eduInstitution}
              onChange={(e) => setEduInstitution(e.target.value)}
              className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Start Year
              </label>
              <input
                type="text"
                placeholder="2016"
                value={eduStartYear}
                onChange={(e) => setEduStartYear(e.target.value)}
                className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                End Year (or Expected)
              </label>
              <input
                type="text"
                placeholder="2020"
                value={eduEndYear}
                onChange={(e) => setEduEndYear(e.target.value)}
                className="w-full bg-white/80 border border-slate-200/80 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200/70">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEduModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Save Education
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
