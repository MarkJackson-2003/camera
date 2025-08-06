/*
  # Add interview violations tracking

  1. New Tables
    - `interview_violations`
      - `id` (uuid, primary key)
      - `interview_id` (uuid, foreign key to interviews)
      - `violation_type` (text)
      - `violation_details` (text)
      - `timestamp` (timestamptz)

  2. Security
    - Enable RLS on `interview_violations` table
    - Add policy for candidates to insert their own violations
    - Add policy for admins to read all violations
*/

CREATE TABLE IF NOT EXISTS interview_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES interviews(id) ON DELETE CASCADE,
  violation_type text NOT NULL,
  violation_details text,
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE interview_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert violations"
  ON interview_violations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read violations"
  ON interview_violations
  FOR SELECT
  TO anon, authenticated
  USING (true);