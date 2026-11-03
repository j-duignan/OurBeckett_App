import type { ReportReason, ReportTarget } from '@/lib/constants';
import { supabase } from '@/lib/supabase';

export async function submitReport(input: {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details: string;
}): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details.trim().slice(0, 1000),
  });
  // Reporting the same thing twice is not an error for the student.
  if (error && !error.message.includes('duplicate key')) throw error;
}
