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

export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/**
 * Short, human-readable reference for a UUID (e.g. `#9fd20e7b`).
 *
 * Full UUIDs are 36 characters and overflow the card header on narrow
 * screens and inside the document title, so they are never displayed raw.
 */
export function formatShortRef(id: string): string {
  if (!id) return '—';
  return `#${id.slice(0, 8)}`;
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
        bg: 'bg-blue-50/90',
        text: 'text-blue-600',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
      };
    case 'Shortlisted':
      return {
        bg: 'bg-violet-50/90',
        text: 'text-violet-600',
        border: 'border-violet-200',
        dot: 'bg-violet-500',
      };
    case 'Interview':
      return {
        bg: 'bg-amber-50/90',
        text: 'text-amber-600',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
      };
    case 'Selected':
      return {
        bg: 'bg-emerald-50/90',
        text: 'text-emerald-600',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
      };
    case 'Rejected':
      return {
        bg: 'bg-rose-50/90',
        text: 'text-rose-600',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
      };
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-500',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      };
  }
}

export function getWorkplaceBadgeClass(type: WorkplaceType): string {
  switch (type) {
    case 'Remote':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'Hybrid':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'On-site':
      return 'text-slate-500 bg-slate-100 border-slate-200';
  }
}
