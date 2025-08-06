import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { getAdminUser, getCandidateUser } from './lib/auth';

// Admin Components
import AdminLogin from './components/Admin/AdminLogin';
import AdminDashboard from './components/Admin/AdminDashboard';

// Candidate Components
import CandidateLogin from './components/Candidate/CandidateLogin';
import CandidateDashboard from './components/Candidate/CandidateDashboard';

// Interview Components
import InterviewInterface from './components/Interview/InterviewInterface';
import InterviewComplete from './components/Interview/InterviewComplete';

import type { Domain, ExamCode, Interview } from './lib/supabase';

type UserType = 'admin' | 'candidate' | null;
type AppState = 'login' | 'dashboard' | 'interview' | 'complete';

function App() {
  const [userType, setUserType] = useState<UserType>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appState, setAppState] = useState<AppState>('login');
  const [interviewData, setInterviewData] = useState<{
    domain: Domain;
    examCode: ExamCode;
    experienceLevel: string;
  } | null>(null);
  const [completedInterview, setCompletedInterview] = useState<Interview | null>(null);

  useEffect(() => {
    // Check for existing sessions
    const adminUser = getAdminUser();
    const candidateUser = getCandidateUser();

    if (adminUser) {
      setUserType('admin');
      setCurrentUser(adminUser);
      setAppState('dashboard');
    } else if (candidateUser) {
      setUserType('candidate');
      setCurrentUser(candidateUser);
      setAppState('dashboard');
    }
  }, []);

  const handleAdminLogin = (admin: any) => {
    setUserType('admin');
    setCurrentUser(admin);
    setAppState('dashboard');
  };

  const handleCandidateLogin = (candidate: any) => {
    setUserType('candidate');
    setCurrentUser(candidate);
    setAppState('dashboard');
  };

  const handleLogout = () => {
    setUserType(null);
    setCurrentUser(null);
    setAppState('login');
    setInterviewData(null);
    setCompletedInterview(null);
  };

  const handleStartInterview = (domain: Domain, examCode: ExamCode, experienceLevel: string) => {
    setInterviewData({ domain, examCode, experienceLevel });
    setAppState('interview');
  };

  const handleInterviewComplete = (interview: Interview) => {
    setCompletedInterview(interview);
    setAppState('complete');
  };

  const handleGoHome = () => {
    setAppState('dashboard');
    setInterviewData(null);
    setCompletedInterview(null);
  };

  // Show login selection if no user type is determined
  if (!userType && appState === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Interview Platform</h1>
            <p className="text-gray-600 mb-8">Select your role to continue</p>
            
            <div className="space-y-4">
              <button
                onClick={() => setUserType('admin')}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-medium text-lg hover:bg-blue-700 transition-colors"
              >
                Admin / HR Login
              </button>
              <button
                onClick={() => setUserType('candidate')}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-medium text-lg hover:bg-green-700 transition-colors"
              >
                Candidate Login
              </button>
            </div>
          </div>
        </div>
        <Toaster position="top-right" />
      </div>
    );
  }

  // Admin Flow
  if (userType === 'admin') {
    if (appState === 'login') {
      return (
        <>
          <AdminLogin onLogin={handleAdminLogin} />
          <Toaster position="top-right" />
        </>
      );
    }
    
    if (appState === 'dashboard') {
      return (
        <>
          <AdminDashboard admin={currentUser} onLogout={handleLogout} />
          <Toaster position="top-right" />
        </>
      );
    }
  }

  // Candidate Flow
  if (userType === 'candidate') {
    if (appState === 'login') {
      return (
        <>
          <CandidateLogin onLogin={handleCandidateLogin} />
          <Toaster position="top-right" />
        </>
      );
    }
    
    if (appState === 'dashboard') {
      return (
        <>
          <CandidateDashboard 
            candidate={currentUser} 
            onLogout={handleLogout}
            onStartInterview={handleStartInterview}
          />
          <Toaster position="top-right" />
        </>
      );
    }
    
    if (appState === 'interview' && interviewData) {
      return (
        <>
          <InterviewInterface
            candidate={currentUser}
            domain={interviewData.domain}
            examCode={interviewData.examCode}
            experienceLevel={interviewData.experienceLevel}
            onComplete={handleInterviewComplete}
          />
          <Toaster position="top-right" />
        </>
      );
    }
    
    if (appState === 'complete' && completedInterview) {
      return (
        <>
          <InterviewComplete
            interview={completedInterview}
            onGoHome={handleGoHome}
          />
          <Toaster position="top-right" />
        </>
      );
    }
  }

  // Fallback
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;