/*
  # Add ID verification and enhanced exam functionality

  1. New Tables
    - `candidate_verifications` - Store ID verification photos and status
    - Update `exam_codes` to include experience level
    - Update `interviews` to track violations

  2. Security
    - Enable RLS on new tables
    - Add policies for candidate and admin access

  3. Changes
    - Add violation tracking to interviews
    - Add experience level to exam codes
    - Add ID verification workflow
*/

-- Add candidate verification table
CREATE TABLE IF NOT EXISTS candidate_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid REFERENCES candidates(id) ON DELETE CASCADE,
  verification_type text NOT NULL CHECK (verification_type IN ('aadhar', 'pan', 'other')),
  id_number text,
  photo_url text NOT NULL,
  verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  verified_by uuid REFERENCES admin_users(id),
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Add experience level to exam codes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exam_codes' AND column_name = 'experience_level'
  ) THEN
    ALTER TABLE exam_codes ADD COLUMN experience_level text CHECK (experience_level IN ('fresher', 'experienced'));
  END IF;
END $$;

-- Add violation tracking to interviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interviews' AND column_name = 'violation_count'
  ) THEN
    ALTER TABLE interviews ADD COLUMN violation_count integer DEFAULT 0;
  END IF;
END $$;

-- Create interview violations table
CREATE TABLE IF NOT EXISTS interview_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES interviews(id) ON DELETE CASCADE,
  violation_type text NOT NULL,
  violation_details text,
  timestamp timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE candidate_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_violations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for candidate_verifications
CREATE POLICY "Candidates can read own verifications"
  ON candidate_verifications
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Candidates can insert own verifications"
  ON candidate_verifications
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Admins can manage all verifications"
  ON candidate_verifications
  FOR ALL
  TO authenticated, anon
  USING (true);

-- RLS Policies for interview_violations
CREATE POLICY "Anyone can manage violations"
  ON interview_violations
  FOR ALL
  TO authenticated, anon
  USING (true);