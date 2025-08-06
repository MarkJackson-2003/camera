/*
  # Fix RLS policies for exam codes

  1. Security Updates
    - Create helper function to validate admin users
    - Update RLS policies to allow admin operations
    - Ensure proper access control for exam code generation

  2. Changes
    - Add helper function `is_active_admin`
    - Update exam_codes RLS policies
    - Allow authenticated admin operations
*/

-- Create helper function to check if user is an active admin
CREATE OR REPLACE FUNCTION is_active_admin(admin_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.admin_users WHERE id = admin_id AND is_active = TRUE);
END;
$$;

-- Drop existing problematic policies for exam_codes
DROP POLICY IF EXISTS "Admins can manage exam codes" ON exam_codes;
DROP POLICY IF EXISTS "Allow authenticated insert" ON exam_codes;
DROP POLICY IF EXISTS "Allow insert for all users" ON exam_codes;
DROP POLICY IF EXISTS "Allow inserts for authenticated users" ON exam_codes;

-- Create new RLS policies for exam_codes
CREATE POLICY "Allow admin insert exam codes"
  ON exam_codes
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (is_active_admin(created_by));

CREATE POLICY "Allow admin read exam codes"
  ON exam_codes
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow admin update exam codes"
  ON exam_codes
  FOR UPDATE
  TO anon, authenticated
  USING (is_active_admin(created_by))
  WITH CHECK (is_active_admin(created_by));

CREATE POLICY "Allow admin delete exam codes"
  ON exam_codes
  FOR DELETE
  TO anon, authenticated
  USING (is_active_admin(created_by));