import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { profileService, resumeSession } from '../../services/api';
import { Button } from '../../components/common/Button';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { formatDate } from '../../utils/formatters';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Download,
  Trash2,
  Sparkles,
  Eye,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export const ResumeUploadPage: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const candidateId = profile?.id ?? user?.id;
if (!candidateId) {
  return (
    <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
      <NoticeBanner
        badge="No Candidate Identity"
        message="Your candidate profile could not be loaded. Please complete your profile or contact your administrator before uploading a resume."
      />
    </div>
  );
}

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setUploadError(null);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    if (e.target.files && e.target.files[0]) {
      await processUpload(e.target.files[0]);
    }
  };

  const processUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      if (!candidateId) {
        throw new Error('No candidate identity available. Please sign in as a candidate first.');
      }
      await profileService.uploadResume(candidateId, file);
      await refreshProfile();
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload resume.';
      setUploadError(message);
      console.error('Failed to upload resume', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = () => {
    if (!profile?.resume?.previewUrl) return;
    const sessionFile = resumeSession.getResume(profile.resume.previewUrl);
    if (!sessionFile) {
      const element = document.createElement('a');
      const file = new Blob(
        ['HIREFLOW APPLICANT DOSSIER\n\nName: ' + profile.fullName + '\nHeadline: ' + profile.headline + '\nEmail: ' + profile.email + '\nPhone: ' + profile.phone + '\nLocation: ' + profile.location + '\n\nTechnical Skills: ' + profile.skills.join(', ') + '\n'],
        { type: 'text/plain' }
      );
      element.href = URL.createObjectURL(file);
      element.download = profile.resume.fileName.replace(/\.pdf$/i, '.txt') || 'Resume_Dossier.txt';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      return;
    }
    const element = document.createElement('a');
    const url = URL.createObjectURL(sessionFile.blob);
    element.href = url;
    element.download = sessionFile.file.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Resume & Document Center
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Manage your primary curriculum vitae used for one-click job applications.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        className="p-8 md:p-12 rounded-2xl border-2 border-dashed transition-all text-center space-y-4"
      >
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 text-blue-400 flex items-center justify-center mx-auto">
          <UploadCloud className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-semibold text-white">
            {isUploading ? 'Uploading...' : 'Upload your technical resume'}
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Drag and drop your file here, or browse local files. Supports PDF and DOCX up to 10MB.
            {uploadError && <span className="text-rose-400"> {uploadError}</span>}
          </p>
        </div>

        <div className="pt-2">
          <label className="inline-block">
            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={isUploading}
              onClick={() => document.getElementById('resume-file-input')?.click()}
            >
              Select Local Document
            </Button>
            <input
              id="resume-file-input"
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>

        {uploadSuccess && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-400 rounded-lg text-xs font-medium flex items-center justify-center gap-2 max-w-md mx-auto">
            <CheckCircle2 className="w-4 h-4" />
            <span>Document parsed and updated to profile successfully!</span>
          </div>
        )}
      </div>

      {profile?.resume && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Active Resume Document</span>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
              title="Download your resume"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Resume</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-lg bg-slate-800 text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{profile.resume.fileName}</div>
              <div className="text-[11px] text-slate-400 font-mono">
                Uploaded {formatDate(profile.resume.uploadedAt)} · {profile.resume.fileSize}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('resume-file-input')?.click()}
            >
              Replace Resume
            </Button>
          </div>
        </div>
      )}

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Eye className="w-4 h-4 text-blue-400" />
            <span>Document Preview & Parser Diagnostics</span>
          </div>
          <span className="text-xs font-mono text-emerald-400">Structured Schema Valid</span>
        </div>

        <div className="p-8 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-sans space-y-6 shadow-inner">
          <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row justify-between md:items-end gap-2">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">{profile?.fullName || 'Alex Morgan'}</h2>
              <p className="text-xs text-blue-400 font-medium mt-0.5">{profile?.headline || 'Staff Frontend Engineer & Design Systems Specialist'}</p>
            </div>
            <div className="text-xs text-slate-400 text-left md:text-right font-mono">
              <div>{profile?.email || 'alex.morgan@example.com'}</div>
              <div>{profile?.location || 'San Francisco, CA'}</div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <h3 className="font-semibold text-slate-100 uppercase tracking-wider text-[11px] border-b border-slate-800/80 pb-1">Executive Summary</h3>
            <p className="leading-relaxed text-slate-300">{profile?.bio || 'Seasoned staff engineer with deep expertise in frontend architecture, type safety, and real-time visualization pipelines.'}</p>
          </div>

          <div className="space-y-3 text-xs">
            <h3 className="font-semibold text-slate-100 uppercase tracking-wider text-[11px] border-b border-slate-800/80 pb-1">Selected Employment Records</h3>
            {(profile?.experience || []).slice(0, 2).map((exp) => (
              <div key={exp.id} className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-white font-semibold">{exp.role} — {exp.company}</span>
                  <span className="text-slate-400 font-mono">{formatDate(exp.startDate)} - {exp.current ? 'Present' : formatDate(exp.endDate)}</span>
                </div>
                <p className="text-slate-300 leading-relaxed line-clamp-2">{exp.description}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-xs">
            <h3 className="font-semibold text-slate-100 uppercase tracking-wider text-[11px] border-b border-slate-800/80 pb-1">Extracted Keywords & Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {(profile?.skills || []).map((skill) => (
                <span key={skill} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">{skill}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
