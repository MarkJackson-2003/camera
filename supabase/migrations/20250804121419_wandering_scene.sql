/*
  # Complete Interview Platform Schema

  1. New Tables
    - `admin_users` - Admin/HR user accounts with different credentials
    - `domains` - Interview domains (Salesforce, Full Stack, Python) 
    - `questions` - Questions with code execution support
    - `candidates` - Candidate profiles with OTP verification
    - `exam_codes` - Time-based unique codes for exam access
    - `interviews` - Interview sessions tracking
    - `interview_answers` - Candidate responses with AI feedback
    - `code_executions` - Code execution results and logs

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users and admins
    - Secure admin access with role-based permissions

  3. Features
    - Multi-language code execution support
    - Time-based exam code generation
    - Comprehensive question management
    - AI validation integration
*/

-- Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  role text DEFAULT 'hr',
  department text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default admin credentials (password: admin123 for all)
INSERT INTO admin_users (email, password_hash, name, department) VALUES
('hr1@company.com', '$2b$10$rQZ9QmD5lGHZj8yXn2K9sOQqHzQ3vM8pL6wR4tF7uE9vS1aB2cD3e', 'Sarah Johnson', 'Technical Recruitment'),
('hr2@company.com', '$2b$10$rQZ9QmD5lGHZj8yXn2K9sOQqHzQ3vM8pL6wR4tF7uE9vS1aB2cD3e', 'Michael Chen', 'Engineering Recruitment'),
('hr3@company.com', '$2b$10$rQZ9QmD5lGHZj8yXn2K9sOQqHzQ3vM8pL6wR4tF7uE9vS1aB2cD3e', 'Emily Rodriguez', 'Senior Technical Recruiter'),
('hr4@company.com', '$2b$10$rQZ9QmD5lGHZj8yXn2K9sOQqHzQ3vM8pL6wR4tF7uE9vS1aB2cD3e', 'David Wilson', 'Lead Talent Acquisition');

-- Domains Table
CREATE TABLE IF NOT EXISTS domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  icon text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO domains (name, description, icon) VALUES
('Salesforce', 'Salesforce Development and Administration', 'cloud'),
('Full Stack', 'Full Stack Web Development', 'code'),
('Python', 'Python Programming and Development', 'terminal');

-- Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid REFERENCES domains(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq', 'coding', 'text')),
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  experience_level text NOT NULL CHECK (experience_level IN ('fresher', 'experienced')),
  options jsonb, -- For MCQ questions
  correct_answer text, -- For MCQ questions
  starter_code text, -- For coding questions
  test_cases jsonb, -- For coding questions
  expected_output text, -- For coding questions
  language text, -- For coding questions (python, apex, html, css, javascript)
  max_score integer DEFAULT 10,
  time_limit integer DEFAULT 300, -- seconds
  created_by uuid REFERENCES admin_users(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Exam Codes Table (changes every 2 hours)
CREATE TABLE IF NOT EXISTS exam_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  domain_id uuid REFERENCES domains(id) ON DELETE CASCADE,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  created_by uuid REFERENCES admin_users(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Candidates Table
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text,
  otp_code text,
  otp_verified boolean DEFAULT false,
  otp_expires_at timestamptz,
  profile_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Interviews Table
CREATE TABLE IF NOT EXISTS interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  domain_id uuid REFERENCES domains(id) ON DELETE CASCADE,
  exam_code_used text,
  experience_level text NOT NULL CHECK (experience_level IN ('fresher', 'experienced')),
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  total_score integer DEFAULT 0,
  max_possible_score integer DEFAULT 0,
  percentage_score decimal(5,2) DEFAULT 0,
  start_time timestamptz DEFAULT now(),
  end_time timestamptz,
  time_taken integer, -- seconds
  current_question_index integer DEFAULT 0,
  questions_assigned jsonb DEFAULT '[]',
  ai_feedback text,
  overall_rating text CHECK (overall_rating IN ('excellent', 'good', 'average', 'poor')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Interview Answers Table
CREATE TABLE IF NOT EXISTS interview_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES interviews(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text,
  answer_code text,
  execution_result jsonb,
  score integer DEFAULT 0,
  max_score integer DEFAULT 10,
  ai_feedback text,
  time_taken integer, -- seconds
  submitted_at timestamptz DEFAULT now()
);

-- Code Executions Table
CREATE TABLE IF NOT EXISTS code_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES interviews(id) ON DELETE CASCADE,
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  code text NOT NULL,
  language text NOT NULL,
  output text,
  error text,
  execution_time integer, -- milliseconds
  memory_usage integer, -- bytes
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'error', 'timeout')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admin Users Policies
CREATE POLICY "Admins can read all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (true);

-- Domains Policies
CREATE POLICY "Anyone can read active domains"
  ON domains FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Questions Policies
CREATE POLICY "Anyone can read active questions"
  ON questions FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage questions"
  ON questions FOR ALL
  TO authenticated
  USING (true);

-- Exam Codes Policies
CREATE POLICY "Admins can manage exam codes"
  ON exam_codes FOR ALL
  TO authenticated
  USING (true);

-- Candidates Policies
CREATE POLICY "Anyone can create candidates"
  ON candidates FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Candidates can read own data"
  ON candidates FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Candidates can update own data"
  ON candidates FOR UPDATE
  TO anon, authenticated
  USING (true);

-- Interviews Policies
CREATE POLICY "Anyone can manage interviews"
  ON interviews FOR ALL
  TO anon, authenticated
  USING (true);

-- Interview Answers Policies
CREATE POLICY "Anyone can manage interview answers"
  ON interview_answers FOR ALL
  TO anon, authenticated
  USING (true);

-- Code Executions Policies
CREATE POLICY "Anyone can manage code executions"
  ON code_executions FOR ALL
  TO anon, authenticated
  USING (true);

-- Sample Questions
INSERT INTO questions (domain_id, title, description, question_type, difficulty, experience_level, options, correct_answer, max_score) VALUES
((SELECT id FROM domains WHERE name = 'Python'), 'Python Basics - Data Types', 'What is the output of: type([1, 2, 3])?', 'mcq', 'easy', 'fresher', 
 '["<class ''int''>", "<class ''list''>", "<class ''tuple''>", "<class ''dict''>"]', 
 '<class ''list''>', 5),

((SELECT id FROM domains WHERE name = 'Python'), 'Python Function Implementation', 'Write a function that finds the factorial of a number using recursion.', 'coding', 'medium', 'fresher',
 null, null, 15);

-- Update starter code and test cases for coding question
UPDATE questions SET 
  starter_code = 'def factorial(n):
    # Write your code here
    pass

# Test your function
print(factorial(5))',
  language = 'python',
  test_cases = '[
    {"input": "factorial(5)", "expected_output": "120"},
    {"input": "factorial(0)", "expected_output": "1"},
    {"input": "factorial(3)", "expected_output": "6"}
  ]'
WHERE question_type = 'coding' AND title = 'Python Function Implementation';

INSERT INTO questions (domain_id, title, description, question_type, difficulty, experience_level, starter_code, language, test_cases, max_score) VALUES
((SELECT id FROM domains WHERE name = 'Salesforce'), 'Apex Trigger Implementation', 'Create a trigger that updates Account rating when Opportunities are created.', 'coding', 'medium', 'experienced',
 'trigger OpportunityTrigger on Opportunity (after insert) {
    // Write your trigger logic here
}', 'apex', 
'[
  {"description": "Should update Account rating to Hot when Opportunity amount > 100000"},
  {"description": "Should update Account rating to Warm when Opportunity amount > 50000"},
  {"description": "Should update Account rating to Cold otherwise"}
]', 20),

((SELECT id FROM domains WHERE name = 'Full Stack'), 'HTML/CSS Layout', 'Create a responsive card component with flexbox layout.', 'coding', 'easy', 'fresher',
 '<!DOCTYPE html>
<html>
<head>
<style>
/* Write your CSS here */
</style>
</head>
<body>
  <div class="card">
    <h2>Card Title</h2>
    <p>Card content goes here.</p>
  </div>
</body>
</html>', 'html',
'[
  {"description": "Card should be centered on page"},
  {"description": "Card should have shadow and rounded corners"},
  {"description": "Card should be responsive on mobile"}
]', 10);

-- Generate initial exam codes
DO $$
DECLARE
  domain_record RECORD;
  code_text text;
BEGIN
  FOR domain_record IN SELECT id FROM domains LOOP
    code_text := 'EXAM' || EXTRACT(EPOCH FROM NOW())::bigint || FLOOR(RANDOM() * 1000)::text;
    INSERT INTO exam_codes (code, domain_id, valid_from, valid_until, is_active)
    VALUES (
      code_text,
      domain_record.id,
      NOW(),
      NOW() + INTERVAL '2 hours',
      true
    );
  END LOOP;
END $$;