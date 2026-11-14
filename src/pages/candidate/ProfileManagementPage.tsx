import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { profileService } from '../../services/api';
import { Button } from '../../components/common/Button';
import { Globe, Github, Linkedin, Check, AlertCircle } from 'lucide-react';

export const ProfileManagementPage: React.FC = () => {
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    website: '',
    github: '',
    linkedin: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || '',
        headline: profile.headline || '',
        email: profile.email || '',
        phone: profile.phone || '',
        location: profile.location || '',
        bio: profile.bio || '',
        website: profile.website || '',
        github: profile.github || '',
        linkedin: profile.linkedin || '',
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);
    try {
      // The server derives the profile owner from the access token; no id is sent.
      const updated = await profileService.updateProfile(formData);
      setFormData({
        fullName: updated.fullName,
        headline: updated.headline,
        email: updated.email,
        phone: updated.phone,
        location: updated.location,
        bio: updated.bio,
        website: updated.website,
        github: updated.github,
        linkedin: updated.linkedin,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update profile', err);
      const apiError = err as { firstFieldError?: string; message?: string };
      setErrorMessage(apiError.firstFieldError ?? apiError.message ?? 'Failed to save your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
          Candidate Profile & Credentials
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          This dossier is shared with verified enterprise recruiters when you submit applications.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
            Personal Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Full Legal Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Professional Headline
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Senior Distributed Systems Engineer"
                value={formData.headline}
                onChange={(e) => setFormData({ ...formData, headline: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                {/* Email is the account identifier: changed through a verified
                    flow, not by editing this form, so it is read-only here. */}
                <input
                  type="email"
                  readOnly
                  value={formData.email}
                  title="Contact support to change your account email"
                  className="w-full bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 cursor-not-allowed focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Primary Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Current Location
              </label>
              <input
                type="text"
                placeholder="San Francisco, CA (Open to Remote)"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Professional Summary / Bio
              </label>
              <textarea
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Links & Profiles */}
        <div className="space-y-4 pt-2">
          <h2 className="text-sm font-semibold text-slate-200 border-b border-slate-800 pb-2">
            Online Presence & Code Repositories
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Portfolio Website
              </label>
              <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2">
                <Globe className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="url"
                  placeholder="https://..."
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full bg-transparent text-xs text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                GitHub Handle / URL
              </label>
              <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2">
                <Github className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="https://github.com/..."
                  value={formData.github}
                  onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                  className="w-full bg-transparent text-xs text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                LinkedIn Profile
              </label>
              <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2">
                <Linkedin className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="https://linkedin.com/in/..."
                  value={formData.linkedin}
                  onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                  className="w-full bg-transparent text-xs text-slate-100 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {errorMessage && (
              <span className="inline-flex items-center gap-1.5 text-rose-400 font-medium">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </span>
            )}
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check className="w-4 h-4" />
                Changes saved successfully
              </span>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSaving}
          >
            Save Profile Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
