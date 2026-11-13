export type UserRole = 'candidate' | 'recruiter' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  title?: string;
  companyId?: string;
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
    previewUrl?: string;
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
  hiredThisMonth: number;
  platformGrowth: string;
}
