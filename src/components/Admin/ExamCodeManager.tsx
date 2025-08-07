import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  RefreshCw, 
  Copy, 
  Clock, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { generateExamCode, getActiveExamCodes } from '../../lib/examCodes';
import type { ExamCode, Domain } from '../../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface ExamCodeManagerProps {
  admin: any;
}

export default function ExamCodeManager({ admin }: ExamCodeManagerProps) {
  const [examCodes, setExamCodes] = useState<ExamCode[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useEffect(() => {
    loadDomains();
    loadExamCodes();
    
    // Set up auto-refresh every minute
    const interval = setInterval(loadExamCodes, 60000);
    return () => clearInterval(interval);
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

  const loadExamCodes = async () => {
    try {
      const codes = await getActiveExamCodes();
      setExamCodes(codes);
    } catch (error) {
      console.error('Error loading exam codes:', error);
      toast.error('Failed to load exam codes');
    }
  };

  const handleGenerateCode = async (domainId: string, experienceLevel: 'fresher' | 'experienced') => {
    setGeneratingFor(`${domainId}-${experienceLevel}`);
    setLoading(true);

    try {
      await generateExamCode(domainId, admin.id, experienceLevel);
      toast.success('Exam code generated successfully!');
      loadExamCodes();
    } catch (error) {
      console.error('Error generating exam code:', error);
      toast.error('Failed to generate exam code');
    } finally {
      setLoading(false);
      setGeneratingFor(null);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Code copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  const getTimeRemaining = (validUntil: string) => {
    const now = new Date();
    const expiry = new Date(validUntil);
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  const isExpiringSoon = (validUntil: string) => {
    const now = new Date();
    const expiry = new Date(validUntil);
    const diffMs = expiry.getTime() - now.getTime();
    return diffMs <= 30 * 60 * 1000; // 30 minutes
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Exam Code Management</h3>
          <p className="text-gray-600">Manage time-based exam access codes</p>
        </div>
        <button
          onClick={loadExamCodes}
          className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Generate New Codes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h4 className="font-medium text-gray-900 mb-4">Generate New Exam Codes</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {domains.map((domain) => {
            const fresherCode = examCodes.find(code => code.domain_id === domain.id && code.experience_level === 'fresher');
            const experiencedCode = examCodes.find(code => code.domain_id === domain.id && code.experience_level === 'experienced');
            
            return (
              <div key={domain.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-gray-900">{domain.name}</span>
                </div>
                
                {/* Fresher Code */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-blue-600 mb-1">Fresher</div>
                  {fresherCode ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-blue-100 px-2 py-1 rounded">
                          {fresherCode.code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(fresherCode.code)}
                          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className={`text-xs flex items-center gap-1 ${
                        isExpiringSoon(fresherCode.valid_until) 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                      }`}>
                        {isExpiringSoon(fresherCode.valid_until) ? (
                          <AlertCircle className="w-2 h-2" />
                        ) : (
                          <CheckCircle className="w-2 h-2" />
                        )}
                        {getTimeRemaining(fresherCode.valid_until)}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No active code</p>
                  )}
                </div>

                {/* Experienced Code */}
                <div className="mb-3">
                  <div className="text-xs font-medium text-purple-600 mb-1">Experienced</div>
                  {experiencedCode ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-purple-100 px-2 py-1 rounded">
                          {experiencedCode.code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(experiencedCode.code)}
                          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <div className={`text-xs flex items-center gap-1 ${
                        isExpiringSoon(experiencedCode.valid_until) 
                          ? 'text-orange-600' 
                          : 'text-green-600'
                      }`}>
                        {isExpiringSoon(experiencedCode.valid_until) ? (
                          <AlertCircle className="w-2 h-2" />
                        ) : (
                          <CheckCircle className="w-2 h-2" />
                        )}
                        {getTimeRemaining(experiencedCode.valid_until)}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">No active code</p>
                  )}
                </div>
                
                {/* Generate Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={() => handleGenerateCode(domain.id, 'fresher')}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {generatingFor === `${domain.id}-fresher` ? (
                      <>
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        {fresherCode ? 'Regenerate Fresher' : 'Generate Fresher'}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleGenerateCode(domain.id, 'experienced')}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {generatingFor === `${domain.id}-experienced` ? (
                      <>
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        {experiencedCode ? 'Regenerate Experienced' : 'Generate Experienced'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Exam Codes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-2">Active Exam Codes</h4>
          <p className="text-sm text-gray-600">
            Share these codes with candidates to grant access to interviews. Codes automatically expire after 2 hours.
          </p>
        </div>

        {examCodes.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No active exam codes</h3>
            <p className="text-gray-600">Generate exam codes to allow candidates to start interviews</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {examCodes.map((examCode) => (
              <div key={examCode.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">
                        {examCode.domain?.name || 'Unknown Domain'}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        examCode.experience_level === 'fresher'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {examCode.experience_level}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        isExpiringSoon(examCode.valid_until)
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {isExpiringSoon(examCode.valid_until) ? 'Expiring Soon' : 'Active'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Code:</span>
                        <span className="font-mono text-lg font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded">
                          {examCode.code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(examCode.code)}
                          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 mt-3 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {getTimeRemaining(examCode.valid_until)}
                      </div>
                      <div>
                        Valid until: {format(new Date(examCode.valid_until), 'MMM dd, yyyy HH:mm')}
                      </div>
                      <div>
                        Created: {formatDistanceToNow(new Date(examCode.created_at))} ago
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
        <h4 className="font-medium text-blue-900 mb-3">How to use Exam Codes</h4>
        <div className="space-y-2 text-sm text-blue-800">
          <p>1. Generate exam codes for each domain you want to conduct interviews for</p>
          <p>2. Share the relevant code with candidates before their scheduled interview</p>
          <p>3. Candidates must enter the code to access the interview system</p>
          <p>4. Codes automatically expire after 2 hours for security</p>
          <p>5. Generate new codes as needed - old codes become invalid</p>
        </div>
      </div>
    </div>
  );
}