/**
 * Typed service layer over the HireFlow FastAPI backend.
 *
 * Every function here performs a real HTTP request. There is no localStorage
 * persistence and no mock data: the browser holds no business state beyond the
 * in-memory access token managed by `http.ts`.
 *
 * DTO mapping happens in this file (`mapJob`, `mapApplication`, ...) so that
 * pages keep working with the existing camelCase view models.
 */

import {
  Application,
  ApplicationStatus,
  AdminMetrics,
  ApiAdminCandidate,
  ApiApplication,
  ApiCandidateProfile,
  ApiCompany,
  ApiJob,
  ApiResume,
  AuthToken,
  CandidateProfile,
  Company,
  Education,
  Job,
  JobFilterParams,
  JobInput,
  MeResponse,
  Page,
  RegisterPayload,
  User,
  UserRole,
  WorkExperience,
} from '../types';
import { ApiError, downloadAuthenticated, http, setAccessToken } from './http';

export { ApiError } from './http';

/* ------------------------------------------------------------------ */
/* Mappers (API snake_case -> view camelCase)                          */
/* ------------------------------------------------------------------ */

const PLACEHOLDER_LOGO =
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80';

export function mapJob(api: ApiJob): Job {
  return {
    id: api.id,
    title: api.title,
    companyId: api.company_id,
    companyName: api.company_name,
    companyLogo: api.company_logo ?? PLACEHOLDER_LOGO,
    location: api.location ?? '',
    workplaceType: api.workplace_type,
    jobType: api.job_type,
    experienceLevel: api.experience_level,
    salaryMin: api.salary_min,
    salaryMax: api.salary_max,
    salaryCurrency: api.salary_currency,
    department: api.department ?? '',
    description: api.description,
    responsibilities: api.responsibilities,
    requirements: api.requirements,
    benefits: api.benefits,
    postedDate: api.posted_date,
    status: api.status,
    applicantsCount: api.applicants_count,
    featured: api.featured,
  };
}

export function mapJobInput(input: JobInput): Record<string, unknown> {
  return {
    title: input.title,
    department: input.department ?? null,
    location: input.location ?? null,
    workplace_type: input.workplace_type,
    job_type: input.job_type,
    experience_level: input.experience_level,
    salary_min: input.salary_min,
    salary_max: input.salary_max,
    salary_currency: input.salary_currency ?? 'USD',
    description: input.description,
    responsibilities: input.responsibilities ?? [],
    requirements: input.requirements ?? [],
    benefits: input.benefits ?? [],
    ...(input.status ? { status: input.status } : {}),
  };
}

export function mapCompany(api: ApiCompany): Company {
  return {
    id: api.id,
    name: api.name,
    logo: api.logo ?? PLACEHOLDER_LOGO,
    industry: api.industry ?? '',
    location: api.location ?? '',
    website: api.website ?? '',
    employeeCount: api.employee_count ?? '',
    description: api.description ?? '',
    verified: api.is_verified,
    openJobsCount: api.open_jobs_count,
  };
}

export function mapApplication(api: ApiApplication): Application {
  return {
    id: api.id,
    jobId: api.job_id,
    jobTitle: api.job_title,
    companyId: api.company_id,
    companyName: api.company_name,
    companyLogo: api.company_logo ?? PLACEHOLDER_LOGO,
    candidateId: api.candidate_id,
    candidateName: api.candidate_name,
    candidateEmail: api.candidate_email,
    candidatePhone: api.candidate_phone ?? '',
    candidateHeadline: api.candidate_headline ?? '',
    resumeFileName: api.resume_file_name ?? '',
    resumeSize: api.resume_size ?? '',
    resumeUrl: api.resume_download_url ?? undefined,
    coverLetter: api.cover_letter ?? '',
    appliedDate: api.applied_date,
    status: api.status,
    stageUpdatedAt: api.stage_updated_at,
    notes: api.notes ?? undefined,
    rating: api.rating ?? undefined,
    history: api.history?.length ? api.history : undefined,
  };
}

export function mapMe(me: MeResponse): User {
  return {
    id: me.id,
    name: me.full_name ?? me.email.split('@')[0],
    email: me.email,
    role: me.role,
    companyId: me.company_id ?? undefined,
    companyName: me.company_name ?? undefined,
    isVerified: me.is_verified,
    createdAt: me.created_at,
  };
}

export function mapCandidateProfile(
  api: ApiCandidateProfile,
  identity: { id: string; email: string }
): CandidateProfile {
  return {
    id: identity.id,
    fullName: api.full_name ?? '',
    headline: api.headline ?? '',
    email: identity.email,
    phone: api.phone ?? '',
    location: api.location ?? '',
    bio: api.bio ?? '',
    website: api.website ?? '',
    github: api.github ?? '',
    linkedin: api.linkedin ?? '',
    skills: api.skills,
    experience: api.experience.map<WorkExperience>((item) => ({
      id: item.id,
      role: item.role,
      company: item.company,
      location: item.location ?? '',
      startDate: item.start_date,
      endDate: item.end_date ?? '',
      current: item.current,
      description: item.description ?? '',
    })),
    education: api.education.map<Education>((item) => ({
      id: item.id,
      degree: item.degree,
      field: item.field ?? '',
      institution: item.institution,
      startYear: item.start_year ?? '',
      endYear: item.end_year ?? '',
      gpa: item.gpa ?? undefined,
    })),
    resume: api.resume
      ? {
        fileName: api.resume.file_name,
        fileSize: api.resume.file_size,
        uploadedAt: api.resume.uploaded_at,
        downloadUrl: api.resume.download_url,
      }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Auth                                                            */
/* ------------------------------------------------------------------ */

export const authService = {
  /** Persist the access token in memory and return the auth token. */
  adoptToken(token: AuthToken): AuthToken {
    setAccessToken(token.access_token);
    return token;
  },

  async login(email: string, password: string): Promise<AuthToken> {
    const token = await http.post<AuthToken>('/auth/login', { email, password });
    return authService.adoptToken(token);
  },

  async register(payload: RegisterPayload): Promise<{ user_id: string; email: string; role: UserRole }> {
    return http.post('/auth/register', payload);
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const me = await http.get<MeResponse>('/auth/me');
      return mapMe(me);
    } catch (error) {
      if (error instanceof ApiError && error.isAuthError) return null;
      throw error;
    }
  },

  async logout(): Promise<void> {
    try {
      await http.post('/auth/logout');
    } catch {
      // Signing out must always succeed locally, even if the API is unreachable.
    } finally {
      setAccessToken(null);
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await http.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_new_password: newPassword,
    });
    setAccessToken(null);
  },
};

/* ------------------------------------------------------------------ */
/* 2. Jobs                                                            */
/* ------------------------------------------------------------------ */

function jobQuery(params?: JobFilterParams): Record<string, unknown> {
  return {
    q: params?.query || undefined,
    location: params?.location || undefined,
    workplace_type: params?.workplaceType && params.workplaceType !== 'All' ? params.workplaceType : undefined,
    job_type: params?.jobType && params.jobType !== 'All' ? params.jobType : undefined,
    experience_level:
      params?.experienceLevel && params.experienceLevel !== 'All' ? params.experienceLevel : undefined,
    department: params?.department && params.department !== 'All' ? params.department : undefined,
    salary_min: params?.salaryMin && params.salaryMin > 0 ? params.salaryMin : undefined,
    salary_max: params?.salaryMax && params.salaryMax > 0 ? params.salaryMax : undefined,
    status: params?.status && params.status !== 'All' ? params.status : undefined,
    company_id: params?.companyId || undefined,
    sort: params?.sort || 'newest',
  };
}

export const jobService = {
  async getJobs(params?: JobFilterParams): Promise<Job[]> {
    const page = await http.get<Page<ApiJob>>('/jobs', { ...jobQuery(params), page_size: 100 });
    return page.items.map(mapJob);
  },

  async getJobById(id: string): Promise<Job | null> {
    try {
      return mapJob(await http.get<ApiJob>(`/jobs/${encodeURIComponent(id)}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  /** Recruiter: all jobs of my company, including drafts and closed. */
  async getMyCompanyJobs(): Promise<Job[]> {
    const jobs = await http.get<ApiJob[]>('/jobs/mine');
    return jobs.map(mapJob);
  },

  async createJob(input: JobInput): Promise<Job> {
    return mapJob(await http.post<ApiJob>('/jobs', mapJobInput(input)));
  },

  async updateJob(id: string, input: Partial<JobInput>): Promise<Job> {
    const body = mapJobInput({ ...(input as JobInput) });
    // Only send keys that were actually supplied, so PATCH stays partial.
    const partial: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) partial[key] = value;
    }
    return mapJob(await http.patch<ApiJob>(`/jobs/${encodeURIComponent(id)}`, partial));
  },

  async deleteJob(id: string): Promise<boolean> {
    await http.del(`/jobs/${encodeURIComponent(id)}`);
    return true;
  },

  async setFeatured(id: string, featured: boolean): Promise<Job> {
    return mapJob(await http.patch<ApiJob>(`/jobs/${encodeURIComponent(id)}/featured`, { featured }));
  },

  async getSavedJobIds(): Promise<string[]> {
    return http.get<string[]>('/jobs/saved/ids');
  },

  async getSavedJobs(): Promise<Job[]> {
    return (await http.get<ApiJob[]>('/jobs/saved')).map(mapJob);
  },

  async toggleSaveJob(jobId: string): Promise<boolean> {
    const ids = await http.post<string[]>(`/jobs/${encodeURIComponent(jobId)}/save`);
    return ids.includes(jobId);
  },

  async getAppliedJobIds(): Promise<string[]> {
    return http.get<string[]>('/jobs/applied/ids');
  },
};

/* ------------------------------------------------------------------ */
/* 3. Applications                                                    */
/* ------------------------------------------------------------------ */

export const applicationService = {
  /** Candidate: my own applications (server scopes by token). */
  async getCandidateApplications(): Promise<Application[]> {
    const rows = await http.get<ApiApplication[]>('/candidates/me/applications');
    return rows.map(mapApplication);
  },

  /** Recruiter: applications for my company (server scopes by membership). */
  async getRecruiterApplications(params?: {
    jobId?: string;
    status?: ApplicationStatus;
    search?: string;
  }): Promise<Application[]> {
    const rows = await http.get<ApiApplication[]>('/applications', {
      job_id: params?.jobId,
      status: params?.status,
      search: params?.search,
    });
    return rows.map(mapApplication);
  },

  async getApplication(applicationId: string): Promise<Application> {
    return mapApplication(await http.get<ApiApplication>(`/applications/${encodeURIComponent(applicationId)}`));
  },

  async applyToJob(jobId: string, coverLetter?: string): Promise<Application> {
    const row = await http.post<ApiApplication>(`/applications/jobs/${encodeURIComponent(jobId)}`, {
      cover_letter: coverLetter?.trim() ? coverLetter : null,
    });
    return mapApplication(row);
  },

  async updateStatus(
    applicationId: string,
    status: ApplicationStatus,
    notes?: string,
    rating?: number
  ): Promise<Application> {
    const row = await http.patch<ApiApplication>(`/applications/${encodeURIComponent(applicationId)}`, {
      status,
      notes: notes ?? null,
      rating: rating ?? null,
    });
    return mapApplication(row);
  },
};

/* ------------------------------------------------------------------ */
/* 4. Candidate profile                                               */
/* ------------------------------------------------------------------ */

function emptyProfile(id: string, email: string): CandidateProfile {
  return {
    id,
    fullName: '',
    headline: '',
    email,
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

export const profileService = {
  async getProfile(identity?: { id: string; email: string }): Promise<CandidateProfile> {
    const me = await http.get<MeResponse>('/auth/me');
    if (me.role !== 'candidate') {
      const current = identity ?? { id: me.id, email: me.email };
      return emptyProfile(current.id, current.email);
    }
    const profile = await http.get<ApiCandidateProfile>('/candidates/me/profile');
    return mapCandidateProfile(profile, { id: me.id, email: me.email });
  },

  async updateProfile(
    updates: Partial<Omit<CandidateProfile, 'id' | 'email' | 'skills' | 'experience' | 'education' | 'resume'>>
  ): Promise<CandidateProfile> {
    const body: Record<string, unknown> = {};
    const map: Record<string, string> = {
      fullName: 'full_name',
      headline: 'headline',
      phone: 'phone',
      location: 'location',
      bio: 'bio',
      website: 'website',
      github: 'github',
      linkedin: 'linkedin',
    };
    for (const [camel, snake] of Object.entries(map)) {
      const value = (updates as Record<string, unknown>)[camel];
      if (value !== undefined) body[snake] = value === '' ? null : value;
    }
    await http.patch<ApiCandidateProfile>('/candidates/me/profile', body);
    return profileService.getProfile();
  },

  async replaceSkills(skills: string[]): Promise<CandidateProfile> {
    await http.put<ApiCandidateProfile>('/candidates/me/skills', { skills });
    return profileService.getProfile();
  },

  async addExperience(entry: Omit<WorkExperience, 'id'>): Promise<CandidateProfile> {
    await http.post<ApiCandidateProfile>('/candidates/me/experience', {
      role: entry.role,
      company: entry.company,
      location: entry.location || null,
      start_date: entry.startDate,
      end_date: entry.current ? null : entry.endDate || null,
      current: entry.current,
      description: entry.description || null,
    });
    return profileService.getProfile();
  },

  async deleteExperience(id: string): Promise<CandidateProfile> {
    await http.del<ApiCandidateProfile>(`/candidates/me/experience/${encodeURIComponent(id)}`);
    return profileService.getProfile();
  },

  async addEducation(entry: Omit<Education, 'id'>): Promise<CandidateProfile> {
    await http.post<ApiCandidateProfile>('/candidates/me/education', {
      degree: entry.degree,
      field: entry.field || null,
      institution: entry.institution,
      start_year: entry.startYear || null,
      end_year: entry.endYear || null,
      gpa: entry.gpa || null,
    });
    return profileService.getProfile();
  },

  async deleteEducation(id: string): Promise<CandidateProfile> {
    await http.del<ApiCandidateProfile>(`/candidates/me/education/${encodeURIComponent(id)}`);
    return profileService.getProfile();
  },

  async uploadResume(file: File): Promise<ApiResume> {
    const form = new FormData();
    form.append('file', file);
    return http.upload<ApiResume>('/candidates/me/resume', form);
  },

  async deleteResume(): Promise<void> {
    await http.del('/candidates/me/resume');
  },

  /** Download through the authenticated endpoint (bearer token attached). */
  async downloadResume(path: string, fallbackName: string): Promise<void> {
    await downloadAuthenticated(path, fallbackName);
  },
};

/* ------------------------------------------------------------------ */
/* 5. Companies                                                       */
/* ------------------------------------------------------------------ */

export const companyService = {
  async getCompanies(): Promise<Company[]> {
    return (await http.get<ApiCompany[]>('/companies')).map(mapCompany);
  },

  async getCompanyById(id: string): Promise<Company | null> {
    try {
      return mapCompany(await http.get<ApiCompany>(`/companies/${encodeURIComponent(id)}`));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },

  /** Recruiter: my own company (no id is ever sent). */
  async getMyCompany(): Promise<Company> {
    return mapCompany(await http.get<ApiCompany>('/companies/me'));
  },

  async updateMyCompany(updates: Partial<Company>): Promise<Company> {
    const body: Record<string, unknown> = {};
    const map: Record<string, string> = {
      name: 'name',
      industry: 'industry',
      location: 'location',
      website: 'website',
      employeeCount: 'employee_count',
      description: 'description',
    };
    for (const [camel, snake] of Object.entries(map)) {
      const value = (updates as Record<string, unknown>)[camel];
      if (value !== undefined) body[snake] = value === '' ? null : value;
    }
    return mapCompany(await http.patch<ApiCompany>('/companies/me', body));
  },
};

/* ------------------------------------------------------------------ */
/* 6. Admin                                                           */
/* ------------------------------------------------------------------ */

export const adminService = {
  async getMetrics(): Promise<AdminMetrics> {
    const metrics = await http.get<{
      total_candidates: number;
      total_companies: number;
      total_jobs: number;
      active_applications: number;
      hired_total: number;
    }>('/admin/metrics');
    return {
      totalCandidates: metrics.total_candidates,
      totalCompanies: metrics.total_companies,
      totalJobs: metrics.total_jobs,
      activeApplications: metrics.active_applications,
      hiredTotal: metrics.hired_total,
    };
  },

  async getCandidates(search?: string): Promise<AdminCandidateRow[]> {
    const rows = await http.get<ApiAdminCandidate[]>('/admin/candidates', { search });
    return rows.map((row) => ({
      id: row.id,
      name: row.full_name ?? row.email.split('@')[0],
      email: row.email,
      headline: row.headline ?? '',
      location: row.location ?? '',
      skills: row.skills,
      applicationsCount: row.applications_count,
      status: row.is_active ? 'active' : 'suspended',
      registeredDate: row.registered_date,
    }));
  },

  async setCandidateActive(candidateId: string, isActive: boolean): Promise<void> {
    await http.patch<ApiAdminCandidate>(`/admin/candidates/${encodeURIComponent(candidateId)}/status`, {
      is_active: isActive,
    });
  },

  async setCompanyVerification(companyId: string, verified: boolean): Promise<Company> {
    return mapCompany(
      await http.patch<ApiCompany>(`/admin/companies/${encodeURIComponent(companyId)}/verification`, {
        is_verified: verified,
      })
    );
  },
};

export interface AdminCandidateRow {
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
