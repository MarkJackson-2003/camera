import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// Validate URL format
const isValidUrl = (url: string) => {
  try {
    new URL(url);
    return url !== 'https://placeholder.supabase.co';
  } catch {
    return false;
  }
};

if (!isValidUrl(supabaseUrl) || supabaseKey === 'placeholder-key') {
  console.warn('⚠️  Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  department: string;
  is_active: boolean;
}

export interface Domain {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
}

export interface Question {
  id: string;
  domain_id: string;
  title: string;
  description: string;
  question_type: 'mcq' | 'coding' | 'text';
  difficulty: 'easy' | 'medium' | 'hard';
  experience_level: 'fresher' | 'experienced';
  options?: string[];
  correct_answer?: string;
  starter_code?: string;
  test_cases?: any[];
  expected_output?: string;
  language?: string;
  max_score: number;
  time_limit: number;
  is_active: boolean;
}

export interface ExamCode {
  id: string;
  code: string;
  domain_id: string;
  experience_level: 'fresher' | 'experienced';
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  domain?: Domain;
}

export interface Candidate {
  id: string;
  email: string;
  name: string;
  phone?: string;
  otp_verified: boolean;
  profile_data: any;
}

export interface CandidateVerification {
  id: string;
  candidate_id: string;
  verification_type: 'aadhar' | 'pan' | 'other';
  id_number?: string;
  photo_url: string;
  verification_status: 'pending' | 'approved' | 'rejected';
  verified_by?: string;
  verified_at?: string;
  created_at: string;
  candidate?: Candidate;
}

export interface Interview {
  id: string;
  candidate_id: string;
  domain_id: string;
  exam_code_used: string;
  experience_level: 'fresher' | 'experienced';
  status: 'in_progress' | 'completed' | 'abandoned';
  total_score: number;
  max_possible_score: number;
  percentage_score: number;
  start_time: string;
  end_time?: string;
  time_taken?: number;
  current_question_index: number;
  questions_assigned: string[];
  violation_count: number;
  ai_feedback?: string;
  overall_rating?: 'excellent' | 'good' | 'average' | 'poor';
  candidate?: Candidate;
  domain?: Domain;
}

export interface InterviewAnswer {
  id: string;
  interview_id: string;
  question_id: string;
  answer_text?: string;
  answer_code?: string;
  execution_result?: any;
  score: number;
  max_score: number;
  ai_feedback?: string;
  time_taken: number;
  question?: Question;
}

export interface CodeExecution {
  id: string;
  interview_id: string;
  question_id: string;
  code: string;
  language: string;
  output?: string;
  error?: string;
  execution_time?: number;
  memory_usage?: number;
  status: 'pending' | 'running' | 'completed' | 'error' | 'timeout';
}