/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';

// Layouts
import { PublicLayout } from './layouts/PublicLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { JobListingsPage } from './pages/public/JobListingsPage';
import { JobDetailsPage } from './pages/public/JobDetailsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';

// Candidate Pages
import { CandidateDashboard } from './pages/candidate/CandidateDashboard';
import { ProfileManagementPage } from './pages/candidate/ProfileManagementPage';
import { SkillsExperiencePage } from './pages/candidate/SkillsExperiencePage';
import { ResumeUploadPage } from './pages/candidate/ResumeUploadPage';
import { MyApplicationsPage } from './pages/candidate/MyApplicationsPage';
import { SavedJobsPage } from './pages/candidate/SavedJobsPage';

// Recruiter Pages
import { RecruiterDashboard } from './pages/recruiter/RecruiterDashboard';
import { CompanyProfilePage } from './pages/recruiter/CompanyProfilePage';
import { ManageJobsPage } from './pages/recruiter/ManageJobsPage';
import { CreateJobPage } from './pages/recruiter/CreateJobPage';
import { EditJobPage } from './pages/recruiter/EditJobPage';
import { ApplicantsListPage } from './pages/recruiter/ApplicantsListPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CandidateManagementPage } from './pages/admin/CandidateManagementPage';
import { CompanyManagementPage } from './pages/admin/CompanyManagementPage';
import { JobModerationPage } from './pages/admin/JobModerationPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Portal Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/jobs" element={<JobListingsPage />} />
            <Route path="/jobs/:id" element={<JobDetailsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Candidate Dashboard Routes. The guard wraps the whole layout so the
              sidebar/navigation never renders for a wrong-role or anonymous user. */}
          <Route
            path="/candidate"
            element={
              <ProtectedRoute allow={['candidate']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CandidateDashboard />} />
            <Route path="profile" element={<ProfileManagementPage />} />
            <Route path="skills" element={<SkillsExperiencePage />} />
            <Route path="resume" element={<ResumeUploadPage />} />
            <Route path="applications" element={<MyApplicationsPage />} />
            <Route path="saved" element={<SavedJobsPage />} />
          </Route>

          {/* Recruiter Workspace Routes */}
          <Route
            path="/recruiter"
            element={
              <ProtectedRoute allow={['recruiter']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RecruiterDashboard />} />
            <Route path="company" element={<CompanyProfilePage />} />
            <Route path="jobs" element={<ManageJobsPage />} />
            <Route path="jobs/new" element={<CreateJobPage />} />
            <Route path="jobs/:id/edit" element={<EditJobPage />} />
            <Route path="applicants" element={<ApplicantsListPage />} />
          </Route>

          {/* Admin Governance Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allow={['admin']}>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="candidates" element={<CandidateManagementPage />} />
            <Route path="companies" element={<CompanyManagementPage />} />
            <Route path="jobs" element={<JobModerationPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
