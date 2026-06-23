import { supabase } from '@/lib/supabase';

export interface AppointmentActivityLog {
  id: string;
  appointment_id: string;
  user_id: string;
  user_name: string;
  action_type: 'created' | 'updated' | 'rescheduled' | 'reassigned' | 'status_changed' | 'cancelled' | 'deleted';
  old_value: any;
  new_value: any;
  field_changed: string | null;
  created_at: string;
}

export async function getAppointmentActivityLog(appointmentId: string): Promise<AppointmentActivityLog[]> {
  const { data, error } = await supabase
    .from('ss_appointment_activity_log')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as AppointmentActivityLog[];
}

export async function logAppointmentActivity(params: {
  appointment_id: string;
  user_id: string;
  user_name: string;
  action_type: AppointmentActivityLog['action_type'];
  old_value?: any;
  new_value?: any;
  field_changed?: string;
}) {
  const { error } = await supabase.from('ss_appointment_activity_log').insert(params);
  if (error) throw error;
}
