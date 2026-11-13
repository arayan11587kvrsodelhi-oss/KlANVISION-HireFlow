import React, { useState, useEffect } from 'react';
import { Company } from '../../types';
import { companyService, adminService } from '../../services/api';
import { Button } from '../../components/common/Button';
import { Building2, Search, ShieldCheck, ShieldAlert, Globe, Check } from 'lucide-react';

export const CompanyManagementPage: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const data = await companyService.getCompanies();
      setCompanies(data);
    } catch (err) {
      console.error('Failed to load companies', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleToggleVerification = async (companyId: string, currentVerified: boolean) => {
    const updated = await adminService.setCompanyVerification(companyId, !currentVerified);
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, verified: updated.verified } : c))
    );
  };

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.industry.toLowerCase().includes(query.toLowerCase()) ||
      c.location.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Company Accreditation & Employer Governance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review corporate domain ownership, legal registration, and grant verified employer badges.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {companies.length} Registered Employers
        </span>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl max-w-md">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter by company name or industry..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs focus:outline-none"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="p-8 text-center text-slate-400">Loading companies...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Employer Entity</th>
                  <th className="p-4">Industry Sector</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Team Scale</th>
                  <th className="p-4">Open Roles</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4 text-right">Accreditation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-white">{c.name}</div>
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <Globe className="w-3 h-3" />
                        <span>{c.website.replace('https://', '')}</span>
                      </a>
                    </td>
                    <td className="p-4 text-slate-300">{c.industry}</td>
                    <td className="p-4 text-slate-300">{c.location}</td>
                    <td className="p-4 font-mono text-slate-300">{c.employeeCount}</td>
                    <td className="p-4 font-mono text-slate-200">{c.openJobsCount} positions</td>
                    <td className="p-4">
                      {c.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant={c.verified ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => handleToggleVerification(c.id, c.verified)}
                      >
                        {c.verified ? 'Revoke Status' : 'Grant Verified'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
