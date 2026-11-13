import {
  Job,
  JobFilterParams,
  Application,
  ApplicationStatus,
  CandidateProfile,
  Company,
  AdminMetrics,
  User,
  UserRole,
} from '../types';
import {
  INITIAL_JOBS,
  INITIAL_COMPANIES,
  INITIAL_APPLICATIONS,
  DEMO_USERS,
} from '../data/mockData';

const STORAGE_KEYS = {
  JOBS: 'hireflow_jobs_v1',
  COMPANIES: 'hireflow_companies_v1',
  APPLICATIONS: 'hireflow_applications_v1',
  CURRENT_USER: 'hireflow_current_user_v1',
} as const;

export class StorageError extends Error {
  public readonly key: string;
  public readonly original?: Error;
  constructor(key: string, message: string, original?: Error) {
    super(`Storage error for key "${key}": ${message}`);
    this.name = 'StorageError';
    this.key = key;
    this.original = original;
  }
}

function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (err) {
    const original = err instanceof Error ? err : new Error(String(err));
    console.error(`Failed to read localStorage key "${key}"`, original);
    return defaultValue;
  }
}

function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    const original = err instanceof Error ? err : new Error(String(err));
    throw new StorageError(key, 'failed to write data to localStorage', original);
  }
}

function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    const original = err instanceof Error ? err : new Error(String(err));
    throw new StorageError(key, 'failed to remove data from localStorage', original);
  }
}

const delay = (ms: number = 120) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Helper to resolve the current demo candidate id.
 */
function getCurrentCandidateId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!stored) return null;
    const user = JSON.parse(stored) as User | null;
    if (!user || user.role !== 'candidate') return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Helper to resolve the current demo recruiter's company id.
 */
function getCurrentRecruiterCompanyId(): string | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!stored) return null;
    const user = JSON.parse(stored) as User | null;
    if (!user || user.role !== 'recruiter') return null;
    return user.companyId ?? null;
  } catch {
    return null;
  }
}

/**
 * Validate a salary range.
 */
function validateSalary(salaryMin: number, salaryMax: number): void {
  if (salaryMin < 0 || salaryMax < 0) {
    throw new Error('Salary values must be non-negative.');
  }
  if (salaryMin > salaryMax) {
    throw new Error('Minimum salary cannot exceed maximum salary.');
  }
}

/**
 * Validate a resume file before it is accepted for demo handling.
 */
function validateResumeFile(file: File): { name: string; size: number; type: string } {
  const allowedExtensions = ['.pdf', '.doc', '.docx'];
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Unsupported file type "${ext}". Allowed types: ${allowedExtensions.join(', ')}.`);
  }

  if (file.type && !allowedMimeTypes.includes(file.type)) {
    throw new Error(`Unsupported MIME type "${file.type}".`);
  }

  const maxSizeBytes = 10 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File exceeds the 10 MB maximum size (${Math.round(file.size / 1024 / 1024)} MB).`);
  }

  return { name: file.name, size: file.size, type: file.type };
}

/**
 * In-memory store for resume Blobs during the current browser session.
 * Temporary demo storage — files are NOT persisted to a server.
 */
const sessionResumeStore = new Map<string, { blob: Blob; file: File }>();

function storeSessionResume(candidateId: string, file: File): string {
  const refId = `resume-${candidateId}-${Date.now()}`;
  sessionResumeStore.set(refId, { blob: file, file });
  return refId;
}

function getSessionResume(refId: string): { blob: Blob; file: File } | undefined {
  return sessionResumeStore.get(refId);
}

/**
 * =========================================================================
 * FASTAPI INTEGRATION NOTE:
 * When connecting to a production FastAPI backend, replace these method bodies
 * with HTTP calls (e.g. axios/fetch) to /api/v1 endpoints. All components rely
 * purely on this typed service interface, so no page-level changes are needed.
 * =========================================================================
 */

// 1. Auth Service
export const authService = {
  async getCurrentUser(): Promise<User | null> {
    await delay(50);
    const stored = getStorageItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    return stored;
  },

  async login(role: UserRole = 'candidate', email?: string): Promise<User> {
    await delay(100);
    const user = DEMO_USERS[role] || {
      id: `usr-${Date.now()}`,
      name: email?.split('@')[0] || 'Demo User',
      email: email || 'user@example.com',
      role,
      title: role === 'candidate' ? 'Frontend Engineer' : role === 'recruiter' ? 'Talent Acquisition' : 'Administrator',
      createdAt: new Date().toISOString(),
    };
    setStorageItem(STORAGE_KEYS.CURRENT_USER, user);
    return user;
  },

  async register(name: string, email: string, role: UserRole): Promise<User> {
    await delay(150);
    const newUser: User = {
      id: `usr-${Date.now()}`,
      name,
      email,
      role,
      title: role === 'candidate' ? 'Job Candidate' : role === 'recruiter' ? 'Hiring Recruiter' : 'Platform Staff',
      createdAt: new Date().toISOString(),
    };
    setStorageItem(STORAGE_KEYS.CURRENT_USER, newUser);
    return newUser;
  },

  async logout(): Promise<void> {
    await delay(50);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  },
};

// 2. Job Service
export const jobService = {
  async getJobs(params?: JobFilterParams): Promise<Job[]> {
    await delay(100);
    let jobs = getStorageItem<Job[]>(STORAGE_KEYS.JOBS, INITIAL_JOBS);

    // Public visibility: only published jobs are visible by default.
    // Recruiters/admins pass includeAll: true to see draft/closed jobs.
    if (!params?.includeAll) {
      jobs = jobs.filter((j) => j.status === 'published');
    }

    if (params?.companyId) {
      jobs = jobs.filter((j) => j.companyId === params.companyId);
    }

    if (params?.status && params.status !== 'All') {
      jobs = jobs.filter((j) => j.status === params.status);
    }

    if (params?.query) {
      const q = params.query.toLowerCase().trim();
      const words = q.split(/\s+/).filter(Boolean);
      jobs = jobs.filter((j) => {
        const fullHaystack = `${j.title} ${j.companyName} ${j.description} ${j.department} ${j.requirements.join(' ')} ${j.responsibilities.join(' ')}`.toLowerCase();
        if (fullHaystack.includes(q)) return true;
        if (words.length > 1 && words.every((w) => fullHaystack.includes(w))) return true;
        return false;
      });
    }

    if (params?.location) {
      const loc = params.location.toLowerCase();
      jobs = jobs.filter((j) => j.location.toLowerCase().includes(loc));
    }

    if (params?.workplaceType && params.workplaceType !== 'All') {
      jobs = jobs.filter((j) => j.workplaceType === params.workplaceType);
    }

    if (params?.jobType && params.jobType !== 'All') {
      jobs = jobs.filter((j) => j.jobType === params.jobType);
    }

    if (params?.experienceLevel && params.experienceLevel !== 'All') {
      jobs = jobs.filter((j) => j.experienceLevel === params.experienceLevel);
    }

    // Salary filtering fix (Task 5):
    // - Minimum salary filter: exclude jobs whose maximum salary is below the requested minimum.
    // - Maximum salary filter: exclude jobs whose minimum salary is above the requested maximum.
    if (params?.salaryMin && params.salaryMin > 0) {
      const minSalary = params.salaryMin;
      jobs = jobs.filter((j) => j.salaryMax >= minSalary);
    }
    if (params?.salaryMax && params.salaryMax > 0) {
      const maxSalary = params.salaryMax;
      jobs = jobs.filter((j) => j.salaryMin <= maxSalary);
    }

    if (params?.department && params.department !== 'All') {
      const dept = params.department;
      jobs = jobs.filter((j) => j.department.toLowerCase() === dept.toLowerCase());
    }

    if (params?.sort === 'salary-high') {
      jobs.sort((a, b) => b.salaryMax - a.salaryMax);
    } else if (params?.sort === 'salary-low') {
      jobs.sort((a, b) => a.salaryMin - b.salaryMin);
    } else {
      // newest
      jobs.sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
    }

    return jobs;
  },

  async getJobById(id: string): Promise<Job | null> {
    await delay(80);
    const jobs = getStorageItem<Job[]>(STORAGE_KEYS.JOBS, INITIAL_JOBS);
    return jobs.find((j) => j.id === id) || null;
  },

  async createJob(jobData: Omit<Job, 'id' | 'postedDate' | 'applicantsCount'>): Promise<Job> {
    await delay(150);

    validateSalary(jobData.salaryMin, jobData.salaryMax);

    if (!jobData.companyId || !jobData.companyName) {
      throw new Error('A job must belong to a company.');
    }

    const jobs = getStorageItem<Job[]>(STORAGE_KEYS.JOBS, INITIAL_JOBS);
    const newJob: Job = {
      ...jobData,
      id: `job-${Date.now()}`,
      postedDate: new Date().toISOString().split('T')[0],
      applicantsCount: 0,
    };
    jobs.unshift(newJob);
    setStorageItem(STORAGE_KEYS.JOBS, jobs);
    return newJob;
  },

  async updateJob(id: string, updates: Partial<Job>, companyId?: string): Promise<Job> {
    await delay(120);
    const jobs = getStorageItem<Job[]>(STORAGE_KEYS.JOBS, INITIAL_JOBS);
    const index = jobs.findIndex((j) => j.id === id);
    if (index === -1) throw new Error('Job not found');

    // Ownership verification: a recruiter may only modify their own company's jobs.
    if (companyId !== undefined && jobs[index].companyId !== companyId) {
      throw new Error('You do not have permission to modify this job requisition.');
    }

    // Prevent reversing a salary range on update.
    const next = { ...jobs[index], ...updates };
    if (next.salaryMin !== undefined && next.salaryMax !== undefined) {
      if (next.salaryMin > next.salaryMax) {
        throw new Error('Minimum salary cannot exceed maximum salary.');
      }
    } else if (next.salaryMin !== undefined && jobs[index].salaryMax !== undefined) {
      if (next.salaryMin > jobs[index].salaryMax) {
        throw new Error('Minimum salary cannot exceed maximum salary.');
      }
    } else if (next.salaryMax !== undefined && jobs[index].salaryMin !== undefined) {
      if (jobs[index].salaryMin > next.salaryMax) {
        throw new Error('Minimum salary cannot exceed maximum salary.');
      }
    }

    jobs[index] = next;
    setStorageItem(STORAGE_KEYS.JOBS, jobs);
    return jobs[index];
  },

  async deleteJob(id: string, companyId?: string): Promise<boolean> {
    await delay(100);
    const jobs = getStorageItem<Job[]>(STORAGE_KEYS.JOBS, INITIAL_JOBS);
    const index = jobs.findIndex((j) => j.id === id);
    if (index === -1) throw new Error('Job not found');

    // Ownership verification
    if (companyId !== undefined && jobs[index].companyId !== companyId) {
      throw new Error('You do not have permission to delete this job requisition.');
    }

    jobs.splice(index, 1);
    setStorageItem(STORAGE_KEYS.JOBS, jobs);
    return true;
  },

  // Saved Jobs for Candidate (scoped per candidate id)
  async getSavedJobIds(candidateId?: string): Promise<string[]> {
    await delay(60);
    const id = candidateId ?? getCurrentCandidateId();
    if (!id) return [];
    return getStorageItem<string[]>(`hireflow_saved_jobs_v1_${id}`, []);
  },

  async toggleSaveJob(jobId: string, candidateId?: string): Promise<boolean> {
    await delay(80);
    const id = candidateId ?? getCurrentCandidateId();
    if (!id) throw new Error('No candidate identity available to save jobs.');
    const saved = getStorageItem<string[]>(`hireflow_saved_jobs_v1_${id}`, []);
    const exists = saved.includes(jobId);
    const nextSaved = exists ? saved.filter((jid) => jid !== jobId) : [...saved, jobId];
    setStorageItem(`hireflow_saved_jobs_v1_${id}`, nextSaved);
    return !exists;
  },
};

// 3. Application Service
export const applicationService = {
  async getCandidateApplications(candidateId: string): Promise<Application[]> {
    await delay(100);
    const apps = getStorageItem<Application[]>(STORAGE_KEYS.APPLICATIONS, INITIAL_APPLICATIONS);
    return apps.filter((a) => a.candidateId === candidateId);
  },

  async getRecruiterApplications(companyId?: string): Promise<Application[]> {
    await delay(120);
    const apps = getStorageItem<Application[]>(STORAGE_KEYS.APPLICATIONS, INITIAL_APPLICATIONS);
    if (!companyId) return apps;
    return apps.filter((a) => a.companyId === companyId);
  },

  async applyToJob(params: {
    job: Job;
    candidate: CandidateProfile;
    coverLetter?: string;
    resumeFileName?: string;
  }): Promise<Application> {
    await delay(200);

    // Job details should not allow applications to closed or unpublished jobs.
    if (params.job.status !== 'published') {
      throw new Error(`Cannot apply to "${params.job.title}": the position is not currently open for applications.`);
    }

    const apps = getStorageItem<Application[]>(STORAGE_KEYS.APPLICATIONS, INITIAL_APPLICATIONS);

    // Check if already applied (same candidate + same job)
    const existing = apps.find(
      (a) => a.jobId === params.job.id && a.candidateId === params.candidate.id
    );
    if (existing) {
      return existing;
    }

    const newApp: Application = {
      id: `app-${Date.now()}`,
      jobId: params.job.id,
      jobTitle: params.job.title,
      companyId: params.job.companyId,
      companyName: params.job.companyName,
      companyLogo: params.job.companyLogo,
      candidateId: params.candidate.id,
      candidateName: params.candidate.fullName,
      candidateEmail: params.candidate.email,
      candidatePhone: params.candidate.phone,
      candidateHeadline: params.candidate.headline,
      resumeFileName: params.resumeFileName || params.candidate.resume?.fileName || 'Resume_Document.pdf',
      resumeSize: params.candidate.resume?.fileSize || '240 KB',
      coverLetter: params.coverLetter || '',
      appliedDate: new Date().toISOString().split('T')[0],
      status: 'Applied',
      stageUpdatedAt: new Date().toISOString().split('T')[0],
      rating: 4,
    };

    apps.unshift(newApp);
    setStorageItem(STORAGE_KEYS.APPLICATIONS, apps);

    // Increment job applicants count
    const jobs = getStorageItem<Job[]>(STORAGE_KEYS.JOBS, INITIAL_JOBS);
    const jobIndex = jobs.findIndex((j) => j.id === params.job.id);
    if (jobIndex !== -1) {
      jobs[jobIndex].applicantsCount += 1;
      setStorageItem(STORAGE_KEYS.JOBS, jobs);
    }

    return newApp;
  },

  async updateStatus(
    applicationId: string,
    status: ApplicationStatus,
    notes?: string,
    rating?: number
  ): Promise<Application> {
    await delay(100);
    const apps = getStorageItem<Application[]>(STORAGE_KEYS.APPLICATIONS, INITIAL_APPLICATIONS);
    const index = apps.findIndex((a) => a.id === applicationId);
    if (index === -1) throw new Error('Application not found');

    // Validate that the status is one of the canonical five
    if (!['Applied', 'Shortlisted', 'Interview', 'Selected', 'Rejected'].includes(status)) {
      throw new Error(`Invalid application status: ${status}`);
    }

    apps[index].status = status;
    apps[index].stageUpdatedAt = new Date().toISOString().split('T')[0];
    if (notes !== undefined) apps[index].notes = notes;
    if (rating !== undefined) apps[index].rating = rating;

    setStorageItem(STORAGE_KEYS.APPLICATIONS, apps);
    return apps[index];
  },
};

// 4. Candidate Profile Service
export const profileService = {
  async getProfile(candidateId?: string): Promise<CandidateProfile> {
    await delay(100);
    const id = candidateId ?? getCurrentCandidateId();
    if (!id) {
      // No candidate identity: return an empty profile shape without touching storage.
      return {
        id: '',
        fullName: '',
        headline: '',
        email: '',
        phone: '',
        location: '',
        bio: '',
        website: '',
        github: '',
        linkedin: '',
        skills: [],
        experience: [],
        education: [],
        resume: null,
      };
    }

    const stored = getStorageItem<CandidateProfile | null>(`hireflow_candidate_profile_v1_${id}`, null);
    if (stored) return stored;

    // No profile exists yet for this candidate. Return an empty profile for the id.
    return {
      id,
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      bio: '',
      website: '',
      github: '',
      linkedin: '',
      skills: [],
      experience: [],
      education: [],
      resume: null,
    };
  },

  async updateProfile(candidateId: string, updates: Partial<CandidateProfile>): Promise<CandidateProfile> {
    await delay(150);
    const current = await this.getProfile(candidateId);
    const updated: CandidateProfile = { ...current, ...updates, id: candidateId };
    setStorageItem(`hireflow_candidate_profile_v1_${candidateId}`, updated);
    return updated;
  },

  async uploadResume(candidateId: string, file: File): Promise<CandidateProfile> {
    await delay(200);

    // Validate before accepting the file (Task 7)
    const metadata = validateResumeFile(file);

    // Store the file as a session Blob for honest demo download. Do NOT
    // persist base64 to localStorage. This is temporary browser-session storage.
    const refId = storeSessionResume(candidateId, file);

    const sizeInKb = `${Math.round(file.size / 1024)} KB`;
    const current = await this.getProfile(candidateId);
    current.resume = {
      fileName: file.name,
      fileSize: sizeInKb,
      uploadedAt: new Date().toISOString().split('T')[0],
      previewUrl: refId, // session reference, not a server URL
    };
    setStorageItem(`hireflow_candidate_profile_v1_${candidateId}`, current);
    return current;
  },
};

// 5. Company Service
export const companyService = {
  async getCompanies(): Promise<Company[]> {
    await delay(80);
    return getStorageItem<Company[]>(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
  },

  async getCompanyById(id: string): Promise<Company | null> {
    await delay(60);
    const companies = getStorageItem<Company[]>(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
    return companies.find((c) => c.id === id) || null;
  },

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company> {
    await delay(120);
    const companies = getStorageItem<Company[]>(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
    const index = companies.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Company not found');
    companies[index] = { ...companies[index], ...updates };
    setStorageItem(STORAGE_KEYS.COMPANIES, companies);
    return companies[index];
  },
};

// 6. Admin Service
export const adminService = {
  async getMetrics(): Promise<AdminMetrics> {
    await delay(100);
    const jobs = getStorageItem<Job[]>(STORAGE_KEYS.JOBS, INITIAL_JOBS);
    const companies = getStorageItem<Company[]>(STORAGE_KEYS.COMPANIES, INITIAL_COMPANIES);
    const applications = getStorageItem<Application[]>(STORAGE_KEYS.APPLICATIONS, INITIAL_APPLICATIONS);

    // Calculate from existing mock records. No fabricated platform statistics.
    const uniqueCandidateIds = new Set(applications.map((a) => a.candidateId));
    const selectedApplications = applications.filter((a) => a.status === 'Selected');

    return {
      totalCandidates: uniqueCandidateIds.size,
      totalCompanies: companies.length,
      totalJobs: jobs.length,
      activeApplications: applications.filter((a) => a.status !== 'Rejected').length,
      hiredThisMonth: selectedApplications.length,
      platformGrowth: 'Demo data — not actual platform metrics',
    };
  },

  async setCompanyVerification(id: string, verified: boolean): Promise<Company> {
    return companyService.updateCompany(id, { verified });
  },

  async setJobStatus(id: string, status: 'published' | 'draft' | 'closed'): Promise<Job> {
    return jobService.updateJob(id, { status });
  },
};

// Expose resume session helpers for the resume page (demo-only, not server storage)
export const resumeSession = {
  getResume(refId: string) {
    return getSessionResume(refId);
  },
};
