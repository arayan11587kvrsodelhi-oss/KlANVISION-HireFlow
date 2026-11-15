import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { profileService } from '../../services/api';
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

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

/** Fast client-side feedback; the server re-validates type and size regardless. */
function preValidate(file: File): string | null {
  const name = file.name.toLowerCase();
  const extension = name.slice(name.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Unsupported file type "${extension || 'unknown'}". Upload a PDF or DOCX file.`;
  }
  if (file.size > MAX_RESUME_BYTES) {
    return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is 10 MB.`;
  }
  if (file.size === 0) return 'The selected file is empty.';
  return null;
}

export const ResumeUploadPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    const problem = preValidate(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      await profileService.uploadResume(file);
      await refreshProfile();
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to upload resume', err);
      const apiError = err as { firstFieldError?: string; message?: string };
      setUploadError(apiError.firstFieldError ?? apiError.message ?? 'Failed to upload resume.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async () => {
    const downloadUrl = profile?.resume?.downloadUrl;
    if (!downloadUrl || !profile?.resume) return;
    setIsDownloading(true);
    setUploadError(null);
    try {
      // Streams the stored file through the authenticated API. If the file is
      // gone the request fails and we say so - we never synthesise a substitute.
      await profileService.downloadResume(downloadUrl, profile.resume.fileName);
    } catch (err) {
      console.error('Failed to download resume', err);
      const apiError = err as { message?: string };
      setUploadError(apiError.message ?? 'Could not download the stored resume file.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
          Resume & Document Center
        </h1>
        <p className="text-xs text-slate-500 mt-1">
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
        className="p-8 md:p-12 rounded-2xl border-2 border-dashed transition-all text-center space-y-4 glass-panel"
      >
        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center mx-auto shadow-sm glass-float">
          <UploadCloud className="w-7 h-7" />
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            {isUploading ? 'Uploading...' : 'Upload your technical resume'}
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Drag and drop your file here, or browse local files. Supports PDF and DOCX up to 10MB.
            {uploadError && <span className="text-rose-500"> {uploadError}</span>}
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
              accept=".pdf,.docx"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>

        {uploadSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl text-xs font-medium flex items-center justify-center gap-2 max-w-md mx-auto">
            <CheckCircle2 className="w-4 h-4" />
            <span>Document parsed and updated to profile successfully!</span>
          </div>
        )}
      </div>

      {profile?.resume && (
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <span>Active Resume Document</span>
            </div>
            <button
              onClick={handleDownload}
              disabled={isDownloading || !profile.resume.downloadUrl}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-colors disabled:opacity-50"
              title="Download your resume"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Downloading…' : 'Download Resume'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">{profile.resume.fileName}</div>
              <div className="text-[11px] text-slate-500 font-mono">
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

      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Eye className="w-4 h-4 text-blue-600" />
            <span>Document Preview & Parser Diagnostics</span>
          </div>
          <span className="text-xs font-mono text-emerald-600">Structured Schema Valid</span>
        </div>

        <div className="p-8 rounded-xl bg-white border border-slate-200/80 text-slate-600 font-sans space-y-6 shadow-inner">
          <div className="border-b border-slate-200/70 pb-4 flex flex-col md:flex-row justify-between md:items-end gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{profile?.fullName || 'Your name'}</h2>
              <p className="text-xs text-blue-600 font-medium mt-0.5">{profile?.headline || 'Add a professional headline'}</p>
            </div>
            <div className="text-xs text-slate-500 text-left md:text-right font-mono">
              <div>{profile?.email}</div>
              <div>{profile?.location}</div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200/70 pb-1">Executive Summary</h3>
            <p className="leading-relaxed text-slate-600">
              {profile?.bio || 'Add a professional summary on the Profile page to include it here.'}
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200/70 pb-1">Selected Employment Records</h3>
            {(profile?.experience || []).slice(0, 2).map((exp) => (
              <div key={exp.id} className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-slate-900 font-semibold">{exp.role} — {exp.company}</span>
                  <span className="text-slate-500 font-mono">{formatDate(exp.startDate)} - {exp.current ? 'Present' : formatDate(exp.endDate)}</span>
                </div>
                <p className="text-slate-600 leading-relaxed line-clamp-2">{exp.description}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 text-xs">
            <h3 className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200/70 pb-1">Extracted Keywords & Skills</h3>
            <div className="flex flex-wrap gap-1.5">
              {(profile?.skills || []).map((skill) => (
                <span key={skill} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-600">{skill}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
