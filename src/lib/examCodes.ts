import { supabase } from './supabase';
import type { ExamCode } from './supabase';

export const generateExamCode = async (domainId: string, adminId: string, experienceLevel: 'fresher' | 'experienced') => {
  try {
    // Generate unique code
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const prefix = experienceLevel === 'fresher' ? 'FR' : 'EX';
    const code = `${prefix}${timestamp}${random}`.slice(-12).toUpperCase();

    // Set validity period (2 hours from now)
    const validFrom = new Date();
    const validUntil = new Date(validFrom.getTime() + 2 * 60 * 60 * 1000);

    // Deactivate previous codes for this domain and experience level
    await supabase
      .from('exam_codes')
      .update({ is_active: false })
      .eq('domain_id', domainId)
      .eq('experience_level', experienceLevel);

    // Insert new code
    const { data, error } = await supabase
      .from('exam_codes')
      .insert({
        code,
        domain_id: domainId,
        experience_level: experienceLevel,
        valid_from: validFrom.toISOString(),
        valid_until: validUntil.toISOString(),
        created_by: adminId,
        is_active: true
      })
      .select(`
        *,
        domain:domains(*)
      `)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

export const getActiveExamCodes = async () => {
  try {
    const { data, error } = await supabase
      .from('exam_codes')
      .select(`
        *,
        domain:domains(*)
      `)
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as ExamCode[];
  } catch (error) {
    throw error;
  }
};

export const validateExamCode = async (code: string) => {
  try {
    const { data, error } = await supabase
      .from('exam_codes')
      .select(`
        *,
        domain:domains(*)
      `)
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .single();

    if (error || !data) {
      throw new Error('Invalid or expired exam code');
    }

    return data as ExamCode;
  } catch (error) {
    throw error;
  }
};

// Auto-generate codes every 2 hours (this would be handled by a cron job in production)
export const autoGenerateExamCodes = async () => {
  try {
    const { data: domains } = await supabase
      .from('domains')
      .select('id')
      .eq('is_active', true);

    if (!domains) return;

    for (const domain of domains) {
      // Check if domain has an active code that's not expiring soon
      const { data: activeCode } = await supabase
        .from('exam_codes')
        .select('*')
        .eq('domain_id', domain.id)
        .eq('is_active', true)
        .gte('valid_until', new Date(Date.now() + 30 * 60 * 1000).toISOString()) // 30 minutes buffer
        .single();

      if (!activeCode) {
        // Generate new code for this domain
        await generateExamCode(domain.id, 'system');
      }
    }
  } catch (error) {
    console.error('Error auto-generating exam codes:', error);
  }
};