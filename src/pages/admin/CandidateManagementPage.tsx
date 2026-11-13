import React, { useState } from 'react';
import { getInitials } from '../../utils/formatters';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { Users, Search, Shield, CheckCircle, Ban, Eye } from 'lucide-react';

interface AdminCandidate {
  id: string;
  name: string;
  email: string;
  headline: string;
  location: string;
  skills: string[];
  applicationsCount: number;
  status: 'active' | 'suspended';
  registeredDate: string;
}

const INITIAL_CANDIDATES: AdminCandidate[] = [
  {
    id: 'cand-alex',
    name: 'Alex Morgan',
    email: 'alex.morgan@example.com',
    headline: 'Staff Frontend Engineer & Design Systems Specialist',
    location: 'San Francisco, CA',
    skills: ['React', 'TypeScript', 'Design Systems', 'WebSockets'],
    applicationsCount: 2,
    status: 'active',
    registeredDate: '2026-01-15',
  },
  {
    id: 'cand-jordan',
    name: 'Dr. Jordan Hayes',
    email: 'jordan.hayes@example.org',
    headline: 'CUDA Kernel & Inference Acceleration Researcher',
    location: 'New York, NY',
    skills: ['PyTorch', 'CUDA', 'Triton', 'C++'],
    applicationsCount: 1,
    status: 'active',
    registeredDate: '2026-02-10',
  },
  {
    id: 'cand-elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@example.com',
    headline: 'Lead WebGL & Visualization Engineer',
    location: 'San Francisco, CA',
    skills: ['WebGL', 'Three.js', 'TypeScript', 'GLSL'],
    applicationsCount: 1,
    status: 'active',
    registeredDate: '2026-03-01',
  },
  {
    id: 'cand-marcus',
    name: 'Marcus Wright',
    email: 'marcus.w@example.com',
    headline: 'Senior Technical Product Manager',
    location: 'San Francisco, CA',
    skills: ['Developer Experience', 'API Design', 'Telemetry'],
    applicationsCount: 1,
    status: 'active',
    registeredDate: '2026-02-18',
  },
  {
    id: 'cand-liam',
    name: 'Liam O’Connor',
    email: 'liam.oc@example.com',
    headline: 'Rust & Distributed Consensus Architect',
    location: 'Seattle, WA',
    skills: ['Rust', 'Raft', 'eBPF', 'Kubernetes'],
    applicationsCount: 1,
    status: 'active',
    registeredDate: '2026-03-12',
  },
];

export const CandidateManagementPage: React.FC = () => {
  const [candidates, setCandidates] = useState<AdminCandidate[]>(INITIAL_CANDIDATES);
  const [query, setQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<AdminCandidate | null>(null);
  const [candidateToToggle, setCandidateToToggle] = useState<AdminCandidate | null>(null);

  const handleConfirmToggle = () => {
    if (!candidateToToggle) return;
    setCandidates((prev) =>
      prev.map((c) =>
        c.id === candidateToToggle.id
          ? { ...c, status: c.status === 'active' ? 'suspended' : 'active' }
          : c
      )
    );
    setCandidateToToggle(null);
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
          <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Candidate Directory & Identity Governance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Supervise candidate user accounts, verified credentials, and activity statuses.
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {candidates.length} Registered Accounts
        </span>
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl max-w-md">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by candidate name, skill, or email..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-transparent text-slate-100 placeholder-slate-400 text-xs focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="p-4">Candidate Profile</th>
                <th className="p-4">Location</th>
                <th className="p-4">Technical Skills</th>
                <th className="p-4">Applications</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200 text-xs">
                        {getInitials(c.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{c.name}</div>
                        <div className="text-[11px] text-slate-400">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300">{c.location}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {c.skills.slice(0, 3).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                          {s}
                        </span>
                      ))}
                      {c.skills.length > 3 && (
                        <span className="text-[10px] text-slate-400">+{c.skills.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono tabular-nums text-slate-200">
                    {c.applicationsCount} sent
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                        c.status === 'active'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50'
                          : 'bg-rose-950/60 text-rose-400 border border-rose-800/50'
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedCandidate(c)}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                        title="View details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setCandidateToToggle(c)}
                        className={`text-xs px-2 py-1 rounded transition-colors font-medium cursor-pointer ${
                          c.status === 'active'
                            ? 'text-rose-400 hover:bg-rose-950/40'
                            : 'text-emerald-400 hover:bg-emerald-950/40'
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
              <span className="text-slate-400 block text-[11px]">Professional Headline</span>
              <p className="text-white font-medium mt-0.5">{selectedCandidate.headline}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
              <div>
                <span className="text-slate-400 block text-[11px]">Email</span>
                <span className="text-white">{selectedCandidate.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Location</span>
                <span className="text-white">{selectedCandidate.location}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800">
              <span className="text-slate-400 block text-[11px] mb-1.5">Registered Technical Skills</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedCandidate.skills.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div className="pt-4 border-t border-slate-800 flex justify-end">
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
      />
    </div>
  );
};
