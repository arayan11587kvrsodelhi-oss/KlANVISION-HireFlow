export type UserRole = 'candidate' | 'recruiter' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  title?: string;
  /** Derived server-side from the recruiter's company membership (read-only). */
  companyId?: string;
  companyName?: string;
  isVerified?: boolean;
  createdAt: string;
}

export interface Company {
  id: string;
  name: string;
  logo: string;
  industry: string;
  location: string;
  website: string;
  employeeCount: string;
  description: string;
  verified: boolean;
  openJobsCount: number;
}

export type WorkplaceType = 'Remote' | 'Hybrid' | 'On-site';
export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
export type ExperienceLevel = 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
export type JobStatus = 'published' | 'draft' | 'closed';

export interface Job {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  companyLogo: string;
  location: string;
  workplaceType: WorkplaceType;
  jobType: JobType;
  experienceLevel: ExperienceLevel;
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: string;
  department: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  postedDate: string;
  status: JobStatus;
  applicantsCount: number;
  featured?: boolean;
}

export const APPLICATION_STATUSES = [
  "Applied",
  "Shortlisted",
  "Interview",
  "Selected",
  "Rejected",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Legacy alias kept temporarily so existing references do not break during migration.
// New code must use ApplicationStatus / APPLICATION_STATUSES only.
export type ApplicationStage = ApplicationStatus;

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  companyLogo: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  candidateAvatar?: string;
  candidateHeadline?: string;
  resumeFileName: string;
  resumeSize: string;
  resumeUrl?: string;
  coverLetter?: string;
  appliedDate: string;
  status: ApplicationStatus;
  stageUpdatedAt: string;
  notes?: string;
  rating?: number;
}

export interface WorkExperience {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface Education {
  id: string;
  degree: string;
  field: string;
  institution: string;
  startYear: string;
  endYear: string;
  gpa?: string;
}

export interface CandidateProfile {
  id: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  bio: string;
  website: string;
  github: string;
  linkedin: string;
  skills: string[];
  experience: WorkExperience[];
  education: Education[];
  resume: {
    fileName: string;
    fileSize: string;
    uploadedAt: string;
    /** Authenticated API path that streams the file (never a static/public URL). */
    downloadUrl?: string;
  } | null;
}

export interface JobFilterParams {
  query?: string;
  location?: string;
  workplaceType?: WorkplaceType | 'All';
  jobType?: JobType | 'All';
  experienceLevel?: ExperienceLevel | 'All';
  salaryMin?: number;
  salaryMax?: number;
  department?: string;
  status?: JobStatus | 'All';
  companyId?: string;
  includeAll?: boolean;
  sort?: 'newest' | 'salary-high' | 'salary-low';
}

export interface AdminMetrics {
  totalCandidates: number;
  totalCompanies: number;
  totalJobs: number;
  activeApplications: number;
  hiredTotal: number;
}

/* ------------------------------------------------------------------ */
/* API transport types                                                 */
/* ------------------------------------------------------------------ */

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role: 'candidate' | 'recruiter';
  company_name?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface MeResponse {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  full_name: string | null;
  company_id: string | null;
  company_name: string | null;
  created_at: string;
}

export interface JobInput {
  title: string;
  department?: string | null;
  location?: string | null;
  workplace_type: WorkplaceType;
  job_type: JobType;
  experience_level: ExperienceLevel;
  salary_min: number;
  salary_max: number;
  salary_currency?: string;
  description: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  status?: JobStatus;
}

/** Server payload shape for a job (snake_case, as returned by FastAPI). */
export interface ApiJob {
  id: string;
  title: string;
  company_id: string;
  company_name: string;
  company_logo: string | null;
  company_verified: boolean;
  location: string | null;
  workplace_type: WorkplaceType;
  job_type: JobType;
  experience_level: ExperienceLevel;
  salary_min: number;
  salary_max: number;
  salary_currency: string;
  department: string | null;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  posted_date: string;
  status: JobStatus;
  applicants_count: number;
  featured: boolean;
}

export interface ApiCompany {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  employee_count: string | null;
  logo: string | null;
  is_verified: boolean;
  open_jobs_count: number;
  created_at: string;
}

export interface ApiApplication {
  id: string;
  job_id: string;
  job_title: string;
  company_id: string;
  company_name: string;
  company_logo: string | null;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string | null;
  candidate_headline: string | null;
  resume_file_name: string | null;
  resume_size: string | null;
  resume_download_url: string | null;
  cover_letter: string | null;
  applied_date: string;
  status: ApplicationStatus;
  stage_updated_at: string;
  notes: string | null;
  rating: number | null;
  history: { previous_status: string; new_status: string; changed_at: string }[];
}

export interface ApiResume {
  id: string;
  file_name: string;
  file_size: string;
  mimetype: string | null;
  uploaded_at: string;
  download_url: string;
}

export interface ApiCandidateProfile {
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  github: string | null;
  linkedin: string | null;
  skills: string[];
  experience: {
    id: string;
    role: string;
    company: string;
    location: string | null;
    start_date: string;
    end_date: string | null;
    current: boolean;
    description: string | null;
  }[];
  education: {
    id: string;
    degree: string;
    field: string | null;
    institution: string;
    start_year: string | null;
    end_year: string | null;
    gpa: string | null;
  }[];
  resume: {
    id: string;
    file_name: string;
    file_size: string;
    uploaded_at: string;
    download_url: string;
  } | null;
  updated_at: string | null;
}

export interface ApiAdminCandidate {
  id: string;
  email: string;
  full_name: string | null;
  headline: string | null;
  location: string | null;
  skills: string[];
  applications_count: number;
  is_active: boolean;
  registered_date: string;
}
