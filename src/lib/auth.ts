import { supabase } from './supabase';
import bcrypt from 'bcryptjs';
import toast from 'react-hot-toast';

// -----------------------
// Admin Authentication
// -----------------------

export const adminLogin = async (email: string, password: string) => {
  try {
    const { data: admin, error } = await supabase
      .from('admin_users')
      .select('*') // include password_hash
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (error || !admin) {
      throw new Error('Admin not found');
    }

    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Remove password_hash before storing
    const { password_hash, ...safeAdmin } = admin;

    localStorage.setItem('adminUser', JSON.stringify(safeAdmin));
    return safeAdmin;
  } catch (error) {
    throw error;
  }
};

export const getAdminUser = () => {
  const adminData = localStorage.getItem('adminUser');
  return adminData ? JSON.parse(adminData) : null;
};

export const adminLogout = () => {
  localStorage.removeItem('adminUser');
};

// -----------------------
// Candidate Authentication (OTP)
// -----------------------

export const sendOTP = async (email: string, name: string, phone?: string) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    const { data: existingCandidate } = await supabase
      .from('candidates')
      .select('*')
      .eq('email', email)
      .single();

    let candidate;

    if (existingCandidate) {
      const { data, error } = await supabase
        .from('candidates')
        .update({
          name,
          phone,
          otp_code: otp,
          otp_verified: false,
          otp_expires_at: otpExpiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('email', email)
        .select()
        .single();

      if (error) throw error;
      candidate = data;
    } else {
      const { data, error } = await supabase
        .from('candidates')
        .insert({
          email,
          name,
          phone,
          otp_code: otp,
          otp_verified: false,
          otp_expires_at: otpExpiresAt.toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      candidate = data;
    }

    // Send OTP using Edge Function
    // For demo purposes, we'll skip the email sending and just log the OTP
    console.log(`OTP for ${email}: ${otp}`);
    toast.success(`OTP sent to ${email}. For demo: ${otp}`);

    return candidate;
  } catch (error) {
    throw error;
  }
};

export const verifyOTP = async (email: string, otp: string) => {
  try {
    const { data: candidates, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otp);

    if (error) {
      throw new Error('Database query failed');
    }

    if (!candidates || candidates.length === 0) {
      throw new Error('Invalid OTP');
    }

    const candidate = candidates[0];

    const now = new Date();
    const expiry = new Date(candidate.otp_expires_at);

    if (now > expiry) {
      throw new Error('OTP has expired');
    }

    const { data: updatedCandidate, error: updateError } = await supabase
      .from('candidates')
      .update({
        otp_verified: true,
        otp_code: null,
        otp_expires_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .select()
      .single();

    if (updateError) throw updateError;

    localStorage.setItem('candidateUser', JSON.stringify(updatedCandidate));
    return updatedCandidate;
  } catch (error) {
    throw error;
  }
};

export const getCandidateUser = () => {
  const candidateData = localStorage.getItem('candidateUser');
  return candidateData ? JSON.parse(candidateData) : null;
};

export const candidateLogout = () => {
  localStorage.removeItem('candidateUser');
};
