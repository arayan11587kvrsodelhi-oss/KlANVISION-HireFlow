import React, { useCallback, useEffect, useState } from 'react';
import { getInitials, formatDate } from '../../utils/formatters';
import { adminService, AdminCandidateRow } from '../../services/api';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { EmptyState } from '../../components/common/EmptyState';
import { Users, Search, Eye } from 'lucide-react';

type AdminCandidate = AdminCandidateRow;

/**
 * Candidate account directory, backed by `GET /admin/candidates`.
 *
 * This page previously rendered five invented candidates held in a constant.
 * The admin role governs accounts (activate/suspend) and deliberately does not
 * receive candidate phone numbers, resumes or application contents.
 */
export const CandidateManagementPage: React.FC = () => {
  const [candidates, setCandidates] = useState<AdminCandidate[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<AdminCandidate | null>(null);
  const [candidateToToggle, setCandidateToToggle] = useState<AdminCandidate | null>(null);

  const loadCandidates = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      setCandidates(await adminService.getCandidates());
    } catch (err) {
      console.error('Failed to load candidates', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load the candidate directory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleConfirmToggle = async () => {
    if (!candidateToToggle) return;
    const nextActive = candidateToToggle.status !== 'active';
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await adminService.setCandidateActive(candidateToToggle.id, nextActive);
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateToToggle.id ? { ...c, status: nextActive ? 'active' : 'suspended' } : c
        )
      );
      setCandidateToToggle(null);
    } catch (err) {
      console.error('Failed to update candidate status', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update the account status.');
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = candidates.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.email.toLowerCase().includes(query.toLowerCase()) ||
      c.skills.some((s) => s.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <NoticeBanner
        badge="Platform Governance"
        message="Candidate User Directory · Manage verified identities and account statuses."
      />
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
            Candidate Directory & Identity Governance
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervise candidate user accounts, verified credentials, and activity statuses.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500">
          {candidates.length} Registered Accounts
        </span>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-3 px-3.5 py-2.5 glass-panel rounded-xl max-w-md">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by candidate name, skill, or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-slate-700 placeholder-slate-400 text-xs focus:outline-none"
        />
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs">
          {errorMessage}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-16 glass-panel rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={candidates.length === 0 ? 'No candidate accounts yet' : 'No candidates match your search'}
          description={
            candidates.length === 0
              ? 'Candidate accounts appear here as soon as people register.'
              : 'Try a different name, email address or skill keyword.'
          }
          actionLabel={candidates.length === 0 ? undefined : 'Clear search'}
          onAction={candidates.length === 0 ? undefined : () => setQuery('')}
        />
      ) : (
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-500 font-semibold border-b border-slate-200/70">
              <tr>
                <th className="p-4">Candidate Profile</th>
                <th className="p-4">Location</th>
                <th className="p-4">Technical Skills</th>
                <th className="p-4">Applications</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-white/80 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-xs shadow-sm">
                        {getInitials(c.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600">{c.location}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {c.skills.slice(0, 3).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-600">
                          {s}
                        </span>
                      ))}
                      {c.skills.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{c.skills.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono tabular-nums text-slate-700">
                    {c.applicationsCount} sent
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                        c.status === 'active'
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                          : 'bg-rose-50 text-rose-600 border border-rose-200'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedCandidate(c)}
                        className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCandidateToToggle(c)}
                        className={`text-xs px-2 py-1 rounded transition-colors font-medium cursor-pointer ${
                          c.status === 'active'
                            ? 'text-rose-500 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {c.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Details Modal */}
      {selectedCandidate && (
        <Modal
          isOpen={!!selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
          title={`Candidate Details: ${selectedCandidate.name}`}
          description={`Registered user ID: ${selectedCandidate.id}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px]">Professional Headline</span>
              <p className="text-slate-900 font-medium mt-0.5">{selectedCandidate.headline}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/70">
              <div>
                <span className="text-slate-500 block text-[11px]">Email</span>
                <span className="text-slate-800">{selectedCandidate.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Location</span>
                <span className="text-slate-800">{selectedCandidate.location || 'Not provided'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/70">
              <div>
                <span className="text-slate-500 block text-[11px]">Registered</span>
                <span className="text-slate-800">{formatDate(selectedCandidate.registeredDate)}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Applications submitted</span>
                <span className="text-slate-800 font-mono">{selectedCandidate.applicationsCount}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200/70">
              <span className="text-slate-500 block text-[11px] mb-1.5">Registered Technical Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedCandidate.skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-200/70 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setSelectedCandidate(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Account Status Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!candidateToToggle}
        onClose={() => setCandidateToToggle(null)}
        onConfirm={handleConfirmToggle}
        title={candidateToToggle?.status === 'active' ? 'Suspend Candidate Account' : 'Reactivate Candidate Account'}
        description={
          candidateToToggle?.status === 'active'
            ? `Are you sure you want to suspend account ${candidateToToggle?.name}? They will be temporarily unable to submit new job applications.`
            : `Reactivate candidate account for ${candidateToToggle?.name}?`
        }
        confirmLabel={candidateToToggle?.status === 'active' ? 'Suspend Account' : 'Activate Account'}
        variant={candidateToToggle?.status === 'active' ? 'danger' : 'primary'}
        isLoading={isSaving}
      />
    </div>
  );
};
