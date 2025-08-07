import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Eye, 
  Search, 
  Filter,
  TrendingUp,
  TrendingDown,
  Award,
  Clock,
  User,
  Mail,
  Phone,
  Camera,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Interview, CandidateVerification } from '../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function CandidateResults() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [verifications, setVerifications] = useState<CandidateVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [selectedVerification, setSelectedVerification] = useState<CandidateVerification | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [domainFilter, setDomainFilter] = useState('all');

  useEffect(() => {
    loadInterviews();
    loadVerifications();
  }, []);

  const loadInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select(`
          *,
          candidate:candidates(*),
          domain:domains(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInterviews(data || []);
    } catch (error) {
      console.error('Error loading interviews:', error);
      toast.error('Failed to load interview results');
    } finally {
      setLoading(false);
    }
  };

  const loadVerifications = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_verifications')
        .select(`
          *,
          candidate:candidates(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVerifications(data || []);
    } catch (error) {
      console.error('Error loading verifications:', error);
    }
  };

  const updateVerificationStatus = async (verificationId: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('candidate_verifications')
        .update({ 
          verification_status: status,
          verified_at: new Date().toISOString()
        })
        .eq('id', verificationId);

      if (error) throw error;
      
      toast.success(`Verification ${status} successfully`);
      loadVerifications();
      setSelectedVerification(null);
    } catch (error) {
      console.error('Error updating verification:', error);
      toast.error('Failed to update verification status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'abandoned': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRatingIcon = (rating?: string) => {
    switch (rating) {
      case 'excellent': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'good': return <TrendingUp className="w-4 h-4 text-blue-600" />;
      case 'average': return <Award className="w-4 h-4 text-yellow-600" />;
      case 'poor': return <TrendingDown className="w-4 h-4 text-red-600" />;
      default: return <Award className="w-4 h-4 text-gray-400" />;
    }
  };

  const filteredInterviews = interviews.filter(interview => {
    const matchesSearch = 
      interview.candidate?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.candidate?.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || interview.status === statusFilter;
    const matchesDomain = domainFilter === 'all' || interview.domain_id === domainFilter;
    
    return matchesSearch && matchesStatus && matchesDomain;
  });

  const exportResults = async (format: 'csv' | 'json') => {
    try {
      const dataToExport = filteredInterviews.map(interview => ({
        candidate_name: interview.candidate?.name,
        candidate_email: interview.candidate?.email,
        candidate_phone: interview.candidate?.phone,
        domain: interview.domain?.name,
        experience_level: interview.experience_level,
        status: interview.status,
        total_score: interview.total_score,
        max_possible_score: interview.max_possible_score,
        percentage_score: interview.percentage_score,
        overall_rating: interview.overall_rating,
        time_taken: interview.time_taken ? Math.floor(interview.time_taken / 60) : 0,
        start_time: interview.start_time,
        end_time: interview.end_time,
        exam_code_used: interview.exam_code_used
      }));

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'csv') {
        const headers = Object.keys(dataToExport[0] || {}).join(',');
        const rows = dataToExport.map(row => 
          Object.values(row).map(value => 
            typeof value === 'string' && value.includes(',') ? `"${value}"` : value
          ).join(',')
        );
        content = [headers, ...rows].join('\n');
        filename = `interview_results_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        content = JSON.stringify(dataToExport, null, 2);
        filename = `interview_results_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Results exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error exporting results:', error);
      toast.error('Failed to export results');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Interview Results</h3>
          <p className="text-gray-600">View and export candidate interview results and ID verifications</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportResults('csv')}
            className="flex items-center gap-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg border border-green-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => exportResults('json')}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* ID Verifications Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2">ID Verifications</h4>
          <p className="text-sm text-gray-600">
            Review and approve candidate ID verifications
          </p>
        </div>

        {verifications.length === 0 ? (
          <div className="p-8 text-center">
            <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No verifications found</h3>
            <p className="text-gray-600">No ID verifications have been submitted yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {verifications.slice(0, 5).map((verification) => (
              <div key={verification.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Camera className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {verification.candidate?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {verification.verification_type.toUpperCase()} • {format(new Date(verification.created_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getVerificationStatusColor(verification.verification_status)}`}>
                      {verification.verification_status}
                    </span>
                    <button
                      onClick={() => setSelectedVerification(verification)}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Search candidates..."
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Domains</option>
              {Array.from(new Set(interviews.map(i => i.domain?.name))).filter(Boolean).map(domain => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredInterviews.length === 0 ? (
          <div className="p-8 text-center">
            <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">
              {interviews.length === 0 
                ? "No interviews have been conducted yet"
                : "Try adjusting your search or filters"
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Candidate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Domain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInterviews.map((interview) => (
                  <tr key={interview.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {interview.candidate?.name}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {interview.candidate?.email}
                            </span>
                            {interview.candidate?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {interview.candidate.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {interview.domain?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {interview.experience_level}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${getScoreColor(interview.percentage_score)}`}>
                          {interview.percentage_score.toFixed(1)}%
                        </span>
                        {getRatingIcon(interview.overall_rating)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {interview.total_score}/{interview.max_possible_score}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(interview.status)}`}>
                        {interview.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-900">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {interview.time_taken 
                          ? `${Math.floor(interview.time_taken / 60)}m ${interview.time_taken % 60}s`
                          : 'N/A'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(interview.start_time), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedInterview(interview)}
                        className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ID Verification Modal */}
      {selectedVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  ID Verification - {selectedVerification.candidate?.name}
                </h3>
                <button
                  onClick={() => setSelectedVerification(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Verification Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Candidate Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name:</span>
                      <span className="font-medium">{selectedVerification.candidate?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Email:</span>
                      <span className="font-medium">{selectedVerification.candidate?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Submitted:</span>
                      <span className="font-medium">{format(new Date(selectedVerification.created_at), 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Verification Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ID Type:</span>
                      <span className="font-medium uppercase">{selectedVerification.verification_type}</span>
                    </div>
                    {selectedVerification.id_number && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">ID Number:</span>
                        <span className="font-medium">{selectedVerification.id_number}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className={`font-medium px-2 py-1 text-xs rounded-full ${getVerificationStatusColor(selectedVerification.verification_status)}`}>
                        {selectedVerification.verification_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ID Photo */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Submitted ID Photo</h4>
                <div className="bg-gray-100 rounded-lg p-4">
                  <img
                    src={selectedVerification.photo_url}
                    alt="ID Verification"
                    className="w-full max-h-96 object-contain rounded-lg"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              {selectedVerification.verification_status === 'pending' && (
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => updateVerificationStatus(selectedVerification.id, 'approved')}
                    className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => updateVerificationStatus(selectedVerification.id, 'rejected')}
                    className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detailed View Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Interview Details - {selectedInterview.candidate?.name}
                </h3>
                <button
                  onClick={() => setSelectedInterview(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Candidate Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Candidate Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name:</span>
                      <span className="font-medium">{selectedInterview.candidate?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Email:</span>
                      <span className="font-medium">{selectedInterview.candidate?.email}</span>
                    </div>
                    {selectedInterview.candidate?.phone && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Phone:</span>
                        <span className="font-medium">{selectedInterview.candidate.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Interview Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Domain:</span>
                      <span className="font-medium">{selectedInterview.domain?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Experience Level:</span>
                      <span className="font-medium">{selectedInterview.experience_level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Exam Code:</span>
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {selectedInterview.exam_code_used}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Score:</span>
                      <span className="font-medium">{selectedInterview.total_score}/{selectedInterview.max_possible_score}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Violations:</span>
                      <span className={`font-medium ${selectedInterview.violation_count >= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                        {selectedInterview.violation_count || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Performance Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedInterview.percentage_score.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Overall Score</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedInterview.total_score}
                    </div>
                    <div className="text-sm text-gray-600">Points Earned</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {selectedInterview.time_taken ? Math.floor(selectedInterview.time_taken / 60) : 0}m
                    </div>
                    <div className="text-sm text-gray-600">Time Taken</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600 capitalize">
                      {selectedInterview.overall_rating || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Rating</div>
                  </div>
                </div>
              </div>

              {/* AI Feedback */}
              {selectedInterview.ai_feedback && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">AI Feedback</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {selectedInterview.ai_feedback}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}