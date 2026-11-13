import { ApplicationStatus, APPLICATION_STATUSES, WorkplaceType } from '../types';

export function formatSalary(min: number, max: number, currency: string = 'USD'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  });
  return `${formatter.format(min)} - ${formatter.format(max)}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return 'Present';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function getInitials(name: string): string {
  if (!name) return 'HF';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function isValidApplicationStatus(value: string): value is ApplicationStatus {
  return APPLICATION_STATUSES.includes(value as ApplicationStatus);
}

export function getStageLabel(stage: ApplicationStatus): string {
  switch (stage) {
    case 'Applied':
      return 'Application Received';
    case 'Shortlisted':
      return 'Resume Screening';
    case 'Interview':
      return 'Technical Interview';
    case 'Selected':
      return 'Offer Extended';
    case 'Rejected':
      return 'Not Selected';
    default:
      return stage;
  }
}

export function getStageColorClasses(stage: ApplicationStatus): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (stage) {
    case 'Applied':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/20',
        dot: 'bg-blue-400',
      };
    case 'Shortlisted':
      return {
        bg: 'bg-purple-500/10',
        text: 'text-purple-400',
        border: 'border-purple-500/20',
        dot: 'bg-purple-400',
      };
    case 'Interview':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/20',
        dot: 'bg-amber-400',
      };
    case 'Selected':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-400',
      };
    case 'Rejected':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/20',
        dot: 'bg-rose-400',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/20',
        dot: 'bg-slate-400',
      };
  }
}

export function getWorkplaceBadgeClass(type: WorkplaceType): string {
  switch (type) {
    case 'Remote':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    case 'Hybrid':
      return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    case 'On-site':
      return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  }
}
