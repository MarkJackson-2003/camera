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
import type { Domain, ExamCode } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface CandidateDashboardProps {
  candidate: any;
  onLogout: () => void;
  onStartInterview: (domain: Domain, examCode: ExamCode, experienceLevel: string) => void;
}

export default function CandidateDashboard({ candidate, onLogout, onStartInterview }: CandidateDashboardProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [examCode, setExamCode] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);
  const [selectedExperience, setSelectedExperience] = useState<'fresher' | 'experienced'>('fresher');
  const [validatedExamCode, setValidatedExamCode] = useState<ExamCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'code' | 'domain' | 'experience' | 'ready'>('code');

  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async () => {
    try {
      const { data, error } = await supabase
        .from('domains')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setDomains(data || []);
    } catch (error) {
      console.error('Error loading domains:', error);
      toast.error('Failed to load domains');
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
      
      // Auto-select the domain for this exam code
      const domain = domains.find(d => d.id === validCode.domain_id);
      if (domain) {
        setSelectedDomain(domain);
        setStep('experience');
      }
      
      toast.success('Exam code validated successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid exam code');
    } finally {
      setLoading(false);
    }
  };

  const handleExperienceSelection = () => {
    setStep('ready');
  };

  const handleStartInterview = () => {
    if (!selectedDomain || !validatedExamCode) {
      toast.error('Missing required information');
      return;
    }

    onStartInterview(selectedDomain, validatedExamCode, selectedExperience);
  };

  const handleLogout = () => {
    candidateLogout();
    toast.success('Logged out successfully');
    onLogout();
  };

  const getDomainIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'salesforce': return <Cloud className="w-8 h-8" />;
      case 'python': return <Terminal className="w-8 h-8" />;
      case 'full stack': return <Code className="w-8 h-8" />;
      default: return <Code className="w-8 h-8" />;
    }
  };

  const getDomainColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'salesforce': return 'from-blue-500 to-blue-700';
      case 'python': return 'from-green-500 to-green-700';
      case 'full stack': return 'from-purple-500 to-purple-700';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Interview Platform</h1>
              <p className="text-gray-600">Welcome, {candidate.name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Start Your Interview?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Follow the steps below to begin your technical interview. Make sure you have a stable internet connection and a quiet environment.
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-12">
          <div className="flex items-center space-x-4">
            {[
              { id: 'code', label: 'Enter Code', icon: Key },
              { id: 'experience', label: 'Experience Level', icon: Award },
              { id: 'ready', label: 'Start Interview', icon: ArrowRight }
            ].map((stepItem, index) => {
              const Icon = stepItem.icon;
              const isActive = step === stepItem.id;
              const isCompleted = 
                (stepItem.id === 'code' && validatedExamCode) ||
                (stepItem.id === 'experience' && step === 'ready');
              
              return (
                <React.Fragment key={stepItem.id}>
                  <div className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-blue-100 text-blue-700' 
                      : isCompleted
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                    <span className="font-medium">{stepItem.label}</span>
                  </div>
                  {index < 2 && (
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {step === 'code' && (
            <div className="text-center space-y-6">
              <div>
                <Key className="w-16 h-16 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Enter Exam Code</h3>
                <p className="text-gray-600">
                  Enter the exam code provided by your interviewer to access the interview system.
                </p>
              </div>

              <div className="max-w-md mx-auto">
                <div className="relative">
                  <input
                    type="text"
                    value={examCode}
                    onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                    className="w-full px-6 py-4 text-center text-xl font-mono tracking-wider border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="EXAM123456"
                    maxLength={12}
                  />
                </div>
                <button
                  onClick={handleValidateExamCode}
                  disabled={loading || !examCode.trim()}
                  className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-5 h-5" />
                  )}
                  {loading ? 'Validating...' : 'Validate Code'}
                </button>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 max-w-2xl mx-auto">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Important Notes:</p>
                    <ul className="space-y-1">
                      <li>• Exam codes are valid for 2 hours only</li>
                      <li>• Get the code from your interviewer before starting</li>
                      <li>• Each code is unique to a specific domain</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'experience' && selectedDomain && validatedExamCode && (
            <div className="text-center space-y-6">
              <div>
                <div className={`w-16 h-16 bg-gradient-to-r ${getDomainColor(selectedDomain.name)} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <div className="text-white">
                    {getDomainIcon(selectedDomain.name)}
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedDomain.name} Interview
                </h3>
                <p className="text-gray-600 mb-6">
                  {selectedDomain.description}
                </p>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">
                  Select Your Experience Level
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
                  <button
                    onClick={() => setSelectedExperience('fresher')}
                    className={`p-6 border-2 rounded-xl transition-colors ${
                      selectedExperience === 'fresher'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-lg font-medium mb-2">Fresher</div>
                    <div className="text-sm text-gray-600">
                      0-2 years of experience
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedExperience('experienced')}
                    className={`p-6 border-2 rounded-xl transition-colors ${
                      selectedExperience === 'experienced'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="text-lg font-medium mb-2">Experienced</div>
                    <div className="text-sm text-gray-600">
                      2+ years of experience
                    </div>
                  </button>
                </div>
              </div>

              <button
                onClick={handleExperienceSelection}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {step === 'ready' && selectedDomain && validatedExamCode && (
            <div className="text-center space-y-6">
              <div>
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Ready to Start!</h3>
                <p className="text-gray-600 mb-6">
                  Everything is set up. You're about to begin your {selectedDomain.name} interview.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-6 max-w-md mx-auto">
                <h4 className="font-medium text-gray-900 mb-4">Interview Details</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Domain:</span>
                    <span className="font-medium">{selectedDomain.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Experience Level:</span>
                    <span className="font-medium capitalize">{selectedExperience}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Exam Code:</span>
                    <span className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">
                      {validatedExamCode.code}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-xl p-4 max-w-2xl mx-auto">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Before You Start:</p>
                    <ul className="space-y-1">
                      <li>• Ensure you have a stable internet connection</li>
                      <li>• Find a quiet environment free from distractions</li>
                      <li>• Close all unnecessary applications and browser tabs</li>
                      <li>• Have your ID ready if requested</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartInterview}
                className="bg-green-600 text-white px-8 py-4 rounded-xl font-medium text-lg hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto"
              >
                Start Interview
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}