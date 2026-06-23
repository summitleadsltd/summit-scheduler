import { supabase } from '@/lib/supabase';

export type AuditActionType =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'rescheduled'
  | 'reassigned'
  | 'status_changed'
  | 'file_uploaded'
  | 'call_recording_added'
  | 'note_added';

export async function logAppointmentActivity(params: {
  appointment_id: string;
  user_id: string;
  user_name: string;
  action_type: AuditActionType;
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  metadata?: Record<string, any>;
}) {
  const { error } = await supabase
    .from('ss_appointment_activity_log')
    .insert({
      ...params,
      old_value: params.old_value || null,
      new_value: params.new_value || null,
      metadata: params.metadata || {},
    });
  if (error) throw error;
}

export async function getAppointmentActivityLog(appointmentId: string) {
  const { data, error } = await supabase
    .from('ss_appointment_activity_log')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getAllActivityLogs(filters?: {
  user_id?: string;
  action_type?: AuditActionType;
  start_date?: string;
  end_date?: string;
}) {
  let query = supabase
    .from('ss_appointment_activity_log')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters?.action_type) {
    query = query.eq('action_type', filters.action_type);
  }
  if (filters?.start_date) {
    query = query.gte('created_at', filters.start_date);
  }
  if (filters?.end_date) {
    query = query.lte('created_at', filters.end_date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
