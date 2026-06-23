import { supabase } from '@/lib/supabase';
import { toEST, formatEST } from '@/lib/timezone';
import { getAvailabilityBlocks } from './technicianService';
import {
  notifyAppointmentCreatedAll,
  notifyAppointmentUpdatedAll,
  notifyAppointmentDeletedAll,
  notifyAppointmentStatusChangedAll,
} from './notificationService';
import { logAppointmentActivity } from './auditTrailService';
import type { Appointment, AppointmentStatus } from '@/types/database';

// Check if a time slot is available for a technician
export async function checkTechnicianAvailability(
  technicianId: string,
  startTime: string,
  endTime: string
): Promise<{ available: boolean; reason?: string }> {
  // Check for existing appointments
  const { data: existingAppointments } = await supabase
    .from('ss_appointments')
    .select('*')
    .eq('technician_id', technicianId)
    .neq('status', 'cancelled')
    .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

  if (existingAppointments && existingAppointments.length > 0) {
    return { available: false, reason: 'Technician already has an appointment during this time' };
  }

  // Check for availability blocks
  const availabilityBlocks = await getAvailabilityBlocks(technicianId);
  const hasConflict = availabilityBlocks.some((block) => {
    return (
      (new Date(block.start_time) < new Date(endTime) &&
       new Date(block.end_time) > new Date(startTime))
    );
  });

  if (hasConflict) {
    return { available: false, reason: 'Technician has marked this time as unavailable' };
  }

  // Check working hours (9 AM - 7 PM)
  const start = new Date(startTime);
  const end = new Date(endTime);
  const startHour = start.getHours();
  const endHour = end.getHours();
  const dayOfWeek = start.getDay();

  // Weekend check
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { available: false, reason: 'Appointments can only be scheduled on weekdays' };
  }

  // Business hours check
  if (startHour < 9 || endHour > 19) {
    return { available: false, reason: 'Appointments must be between 9 AM and 7 PM' };
  }

  return { available: true };
}

export async function getAppointments(filters?: {
  technician_id?: string;
  status?: AppointmentStatus;
  start_date?: string;
  end_date?: string;
}) {
  let query = supabase
    .from('ss_appointments')
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .order('start_time', { ascending: true });

  if (filters?.technician_id) {
    query = query.eq('technician_id', filters.technician_id);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.start_date) {
    query = query.gte('start_time', filters.start_date);
  }
  if (filters?.end_date) {
    query = query.lte('start_time', filters.end_date);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Appointment[];
}

export async function getAppointment(id: string) {
  const { data, error } = await supabase
    .from('ss_appointments')
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Appointment;
}

export async function createAppointment(appointment: {
  customer_id: string;
  technician_id: string;
  address_id: string;
  start_time: string;
  end_time: string;
  appointment_type: string;
  notes?: string;
  created_by: string;
}, user: { id: string; name: string }) {
  // Check availability before creating appointment
  const availabilityCheck = await checkTechnicianAvailability(
    appointment.technician_id,
    appointment.start_time,
    appointment.end_time
  );

  if (!availabilityCheck.available) {
    throw new Error(availabilityCheck.reason || 'Time slot is not available');
  }

  const { data, error } = await supabase
    .from('ss_appointments')
    .insert({ ...appointment, status: 'scheduled' })
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .single();
  if (error) throw error;

  const apt = data as Appointment;

  // Log audit trail
  await logAppointmentActivity({
    appointment_id: apt.id,
    user_id: user.id,
    user_name: user.name,
    action_type: 'created',
    new_value: {
      customer_id: apt.customer_id,
      technician_id: apt.technician_id,
      start_time: apt.start_time,
      end_time: apt.end_time,
      appointment_type: apt.appointment_type,
      status: apt.status,
    },
  });

  // Notify all technicians and managers
  await notifyAppointmentCreatedAll(
    apt.technician?.name || 'Unknown',
    `${apt.customer?.first_name} ${apt.customer?.last_name}`,
    formatEST(apt.start_time, 'MMM d, h:mm a'),
    formatEST(apt.end_time, 'h:mm a')
  );

  return apt;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus, user: { id: string; name: string }) {
  // Get current appointment for audit trail
  const { data: currentApt } = await supabase
    .from('ss_appointments')
    .select('status')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('ss_appointments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*)
    `)
    .single();
  if (error) throw error;

  const apt = data as Appointment;

  // Log audit trail
  await logAppointmentActivity({
    appointment_id: apt.id,
    user_id: user.id,
    user_name: user.name,
    action_type: 'status_changed',
    old_value: { status: currentApt?.status },
    new_value: { status: apt.status },
  });

  // Notify all technicians and managers
  await notifyAppointmentStatusChangedAll(
    apt.technician?.name || 'Unknown',
    `${apt.customer?.first_name} ${apt.customer?.last_name}`,
    status
  );

  return apt;
}

export async function rescheduleAppointment(id: string, start_time: string, end_time: string, technician_id?: string, user?: { id: string; name: string }) {
  // Get current appointment for audit trail
  const { data: currentApt } = await supabase
    .from('ss_appointments')
    .select('start_time, end_time, technician_id')
    .eq('id', id)
    .single();

  const update: Record<string, string> = {
    start_time,
    end_time,
    updated_at: new Date().toISOString(),
  };
  if (technician_id) update.technician_id = technician_id;

  const { data, error } = await supabase
    .from('ss_appointments')
    .update(update)
    .eq('id', id)
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .single();
  if (error) throw error;

  const apt = data as Appointment;

  // Log audit trail
  if (user) {
    const actionType = technician_id && technician_id !== currentApt?.technician_id ? 'reassigned' : 'rescheduled';
    await logAppointmentActivity({
      appointment_id: apt.id,
      user_id: user.id,
      user_name: user.name,
      action_type: actionType,
      old_value: {
        start_time: currentApt?.start_time,
        end_time: currentApt?.end_time,
        technician_id: currentApt?.technician_id,
      },
      new_value: {
        start_time: apt.start_time,
        end_time: apt.end_time,
        technician_id: apt.technician_id,
      },
    });
  }

  // Notify all technicians and managers
  await notifyAppointmentUpdatedAll(
    apt.technician?.name || 'Unknown',
    `${apt.customer?.first_name} ${apt.customer?.last_name}`,
    formatEST(apt.start_time, 'MMM d, h:mm a'),
    formatEST(apt.end_time, 'h:mm a')
  );

  return apt;
}

export async function updateAppointment(id: string, update: {
  start_time?: string;
  end_time?: string;
  appointment_type?: string;
  notes?: string;
  status?: AppointmentStatus;
  technician_id?: string;
}, user?: { id: string; name: string }) {
  // Get current appointment for audit trail
  const { data: currentApt } = await supabase
    .from('ss_appointments')
    .select('start_time, end_time, appointment_type, notes, status, technician_id')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('ss_appointments')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*),
      address:ss_addresses(*)
    `)
    .single();
  if (error) throw error;

  const apt = data as Appointment;

  // Log audit trail
  if (user) {
    await logAppointmentActivity({
      appointment_id: apt.id,
      user_id: user.id,
      user_name: user.name,
      action_type: 'updated',
      old_value: {
        start_time: currentApt?.start_time,
        end_time: currentApt?.end_time,
        appointment_type: currentApt?.appointment_type,
        notes: currentApt?.notes,
        status: currentApt?.status,
        technician_id: currentApt?.technician_id,
      },
      new_value: update,
    });
  }

  // Notify all technicians and managers if time changed
  if (update.start_time || update.end_time) {
    await notifyAppointmentUpdatedAll(
      apt.technician?.name || 'Unknown',
      `${apt.customer?.first_name} ${apt.customer?.last_name}`,
      formatEST(apt.start_time, 'MMM d, h:mm a'),
      formatEST(apt.end_time, 'h:mm a')
    );
  }

  return apt;
}

export async function deleteAppointment(id: string, user?: { id: string; name: string }) {
  // Get appointment details before deletion for notification and audit trail
  const { data: apt } = await supabase
    .from('ss_appointments')
    .select(`
      *,
      customer:ss_customers(*),
      technician:ss_users!ss_appointments_technician_id_fkey(*)
    `)
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('ss_appointments')
    .delete()
    .eq('id', id);
  if (error) throw error;

  // Log audit trail
  if (user && apt) {
    await logAppointmentActivity({
      appointment_id: apt.id,
      user_id: user.id,
      user_name: user.name,
      action_type: 'deleted',
      old_value: {
        customer_id: apt.customer_id,
        technician_id: apt.technician_id,
        start_time: apt.start_time,
        end_time: apt.end_time,
        appointment_type: apt.appointment_type,
        status: apt.status,
      },
    });
  }

  // Notify all technicians and managers
  if (apt) {
    await notifyAppointmentDeletedAll(
      apt.technician?.name || 'Unknown',
      `${apt.customer?.first_name} ${apt.customer?.last_name}`,
      formatEST(apt.start_time, 'MMM d, h:mm a')
    );
  }
}

export async function getTodayAppointments(technicianId?: string) {
  const today = toEST(new Date());
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getAppointments({
    technician_id: technicianId,
    start_date: today.toISOString(),
    end_date: tomorrow.toISOString(),
  });
}

export async function getWeekAppointments(technicianId?: string) {
  const today = toEST(new Date());
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return getAppointments({
    technician_id: technicianId,
    start_date: today.toISOString(),
    end_date: weekEnd.toISOString(),
  });
}
