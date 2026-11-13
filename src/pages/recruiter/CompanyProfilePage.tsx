import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Company } from '../../types';
import { companyService } from '../../services/api';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { Button } from '../../components/common/Button';
import { Building2, Globe, MapPin, Users, ShieldCheck, Check } from 'lucide-react';

export const CompanyProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    location: '',
    website: '',
    employeeCount: '',
    description: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      setIsLoading(true);
      try {
        const companyId = user?.companyId;
if (!companyId) {
  return (
    <div className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
      <NoticeBanner
        badge="No Company Assignment"
        message="Please complete your company profile to access company operations. Contact your administrator if this is incorrect."
      />
    </div>
  );
}
        const comp = await companyService.getCompanyById(companyId);
        if (comp) {
          setCompany(comp);
          setFormData({
            name: comp.name,
            industry: comp.industry,
            location: comp.location,
            website: comp.website,
            employeeCount: comp.employeeCount,
            description: comp.description,
          });
        } else {
          setCompany({
            id: companyId,
            name: '',
            logo: '',
            industry: '',
            location: '',
            website: '',
            employeeCount: '',
            description: '',
            verified: false,
            openJobsCount: 0,
          });
          setFormData({ name: '', industry: '', location: '', website: '', employeeCount: '', description: '' });
        }
      } catch (err) {
        console.error('Failed to load company profile', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompany();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setIsSaving(true);
    try {
      const updated = await companyService.updateCompany(company.id, formData);
      setCompany(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Failed to update company profile', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading company record...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Employer Profile & Branding
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure how your company appears on public job listings and candidate correspondence.
          </p>
        </div>

        {company?.verified && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            <ShieldCheck className="w-4 h-4" />
            <span>Verified Employer Status</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Company Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Primary Industry
            </label>
            <input
              type="text"
              required
              value={formData.industry}
              onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Headquarters / Main Hub
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Company Website URL
            </label>
            <input
              type="url"
              required
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Team Size Range
            </label>
            <select
              value={formData.employeeCount}
              onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="1 - 10">1 - 10 employees (Early Stage)</option>
              <option value="10 - 50">10 - 50 employees</option>
              <option value="50 - 150">50 - 150 employees</option>
              <option value="150 - 500">150 - 500 employees (Scaleup)</option>
              <option value="500 - 1000">500 - 1,000 employees</option>
              <option value="1000+">1,000+ employees (Enterprise)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              About the Company / Mission Statement
            </label>
            <textarea
              rows={4}
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <Check className="w-4 h-4" />
                Company profile updated
              </span>
            )}
          </div>
          <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
            Save Company Profile
          </Button>
        </div>
      </form>
    </div>
  );
};
