import React, { useState, useEffect } from 'react';
import { 
  Code, 
  Cloud, 
  Terminal, 
  LogOut, 
  ArrowRight,
  Key,
  Clock,
  Award,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { candidateLogout } from '../../lib/auth';
import { validateExamCode } from '../../lib/examCodes';
import type { Domain, ExamCode, CandidateVerification } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface CandidateDashboardProps {
  candidate: any;
  onLogout: () => void;
  onStartInterview: (domain: Domain, examCode: ExamCode) => void;
}

export default function CandidateDashboard({ candidate, onLogout, onStartInterview }: CandidateDashboardProps) {
  const [examCode, setExamCode] = useState('');
  const [validatedExamCode, setValidatedExamCode] = useState<ExamCode | null>(null);
  const [verification, setVerification] = useState<CandidateVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'code' | 'ready'>('code');

  useEffect(() => {
    checkVerificationStatus();
  }, []);

  const checkVerificationStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_verifications')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setVerification(data);
      }
    } catch (error) {
      // No verification found, which is fine
      console.log('No verification found');
    }
  };

  const handleValidateExamCode = async () => {
    if (!examCode.trim()) {
      toast.error('Please enter an exam code');
      return;
    }

    setLoading(true);
    try {
      const validCode = await validateExamCode(examCode.trim());
      setValidatedExamCode(validCode);
      setStep('ready');
      
      toast.success('Exam code validated successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid exam code');
    } finally {
      setLoading(false);
    }
  };

  const handleStartInterview = () => {
    onStartInterview(validatedExamCode.domain!, validatedExamCode);
  };

  const handleLogout = () => {
    candidateLogout();
    toast.success('Logged out successfully');
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Interview Platform
              </h1>
              <p className="text-gray-700">Welcome, {candidate.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
            Ready to Start Your Interview?
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Follow the steps below to begin your technical interview. Make sure you have a stable internet connection and a quiet environment.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-4">
            {[
              { id: 'code', label: 'Enter Code', icon: Key },
              { id: 'ready', label: 'Start Interview', icon: ArrowRight }
            ].map((stepItem, index) => {
              const Icon = stepItem.icon;
              const isActive = step === stepItem.id;
              const isCompleted = 
                (stepItem.id === 'code' && validatedExamCode);
              
              return (
                <React.Fragment key={stepItem.id}>
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700 shadow-md' 
                      : isCompleted
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 shadow-md'
                      : 'bg-white/50 text-gray-500'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                    <span className="font-medium">{stepItem.label}</span>
                  </div>
                  {index < 1 && (
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Verification Status */}
        {verification && (
          <div className={`mb-8 p-6 rounded-2xl border shadow-lg ${
            verification.verification_status === 'approved' 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
              : verification.verification_status === 'rejected'
              ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'
              : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200'
          }`}>
            <p className="text-center font-semibold text-lg">
              ID Verification Status: <span className="capitalize">{verification.verification_status}</span>
            </p>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-10">
          {step === 'code' && (
            <div className="text-center space-y-6">
              <div>
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Key className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-3">Enter Exam Code</h3>
                <p className="text-gray-600 text-lg">
                  Enter the exam code provided by your interviewer to access the interview system.
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <div className="relative">
                  <input
                    type="text"
                    value={examCode}
                    onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                    className="w-full px-6 py-4 text-center text-2xl font-mono tracking-wider border-2 border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-inner"
                    placeholder="EXAM123456"
                    maxLength={12}
                  />
                </div>
                <button
                  onClick={handleValidateExamCode}
                  disabled={loading || !examCode.trim()}
                  className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-3 shadow-lg"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-6 h-6" />
                  )}
                  {loading ? 'Validating...' : 'Validate Code'}
                </button>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 max-w-2xl mx-auto border border-blue-200">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-2">Important Notes:</p>
                    <ul className="space-y-2">
                      <li>• Exam codes are valid for 2 hours only</li>
                      <li>• Get the code from your interviewer before starting</li>
                      <li>• Each code is unique to a specific domain</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'ready' && validatedExamCode && (
            <div className="text-center space-y-6">
              <div>
                <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-gray-900 mb-3">Ready to Start!</h3>
                <p className="text-gray-600 text-lg mb-8">
                  Everything is set up. You're about to begin your {validatedExamCode.domain?.name} interview.
                </p>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-8 max-w-md mx-auto border border-gray-200 shadow-inner">
                <h4 className="font-semibold text-gray-900 mb-6 text-lg">Interview Details</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Domain:</span>
                    <span className="font-semibold">{validatedExamCode.domain?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Experience Level:</span>
                    <span className="font-semibold capitalize">{validatedExamCode.experience_level}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Exam Code:</span>
                    <span className="font-mono text-xs bg-white px-3 py-1 rounded-lg shadow-sm">
                      {validatedExamCode.code}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 max-w-2xl mx-auto border border-amber-200">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-2">Before You Start:</p>
                    <ul className="space-y-2">
                      <li>• Ensure you have a stable internet connection</li>
                      <li>• Find a quiet environment free from distractions</li>
                      <li>• Close all unnecessary applications and browser tabs</li>
                      <li>• Have your ID ready if requested</li>
                    </ul>
                  </div>
                </div>
              </div>

              {!verification && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6">
                  <p className="text-red-800 text-sm">
                    <strong>Note:</strong> ID verification is required before starting the interview. 
                    You will be prompted to verify your identity in the next step.
                  </p>
                </div>
              )}

              <button
                onClick={handleStartInterview}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-10 py-5 rounded-2xl font-semibold text-xl hover:from-green-700 hover:to-emerald-700 transition-all duration-200 flex items-center gap-3 mx-auto shadow-lg transform hover:scale-105"
              >
                Start Interview
                <ArrowRight className="w-7 h-7" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}