import { supabase } from '@/lib/supabase';
import { formatEST } from '@/lib/timezone';
import { notifyAvailabilityBlockCreated, notifyAvailabilityBlockDeleted } from './notificationService';
import type { User, AvailabilityBlock } from '@/types/database';

export async function getTechnicians() {
  const { data, error } = await supabase
    .from('ss_users')
    .select('*')
    .eq('role', 'technician')
    .order('name');
  if (error) throw error;
  return data as User[];
}

export async function getActiveTechnicians() {
  const { data, error } = await supabase
    .from('ss_users')
    .select('*')
    .eq('role', 'technician')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data as User[];
}

export async function getTechnician(id: string) {
  const { data, error } = await supabase
    .from('ss_users')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as User;
}

export async function createTechnician(technician: {
  name: string;
  email: string;
  phone?: string;
}) {
  // Create auth user first, then profile
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: technician.email,
    password: 'TempPass123!', // Should be changed on first login
    email_confirm: true,
  });
  if (authError) throw authError;

  const { data, error } = await supabase
    .from('ss_users')
    .insert({
      id: authData.user.id,
      name: technician.name,
      email: technician.email,
      phone: technician.phone,
      role: 'technician',
      active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

export async function updateTechnician(id: string, updates: Partial<User>) {
  const { data, error } = await supabase
    .from('ss_users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

export async function getAvailabilityBlocks(technicianId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('ss_availability_blocks')
    .select('*')
    .eq('technician_id', technicianId)
    .order('start_time');

  if (startDate) query = query.gte('start_time', startDate);
  if (endDate) query = query.lte('end_time', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data as AvailabilityBlock[];
}

export async function createAvailabilityBlock(block: {
  technician_id: string;
  start_time: string;
  end_time: string;
  reason: string;
}) {
  const { data, error } = await supabase
    .from('ss_availability_blocks')
    .insert(block)
    .select('*, technician:ss_users(*)')
    .single();
  if (error) throw error;

  const blockData = data as AvailabilityBlock & { technician: User };

  // Notify all technicians and managers
  await notifyAvailabilityBlockCreated(
    blockData.technician?.name || 'Unknown',
    formatEST(blockData.start_time, 'MMM d, h:mm a'),
    formatEST(blockData.end_time, 'h:mm a'),
    blockData.reason
  );

  return data as AvailabilityBlock;
}

export async function deleteAvailabilityBlock(id: string) {
  // Get block details before deletion for notification
  const { data: block } = await supabase
    .from('ss_availability_blocks')
    .select('*, technician:ss_users(*)')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('ss_availability_blocks')
    .delete()
    .eq('id', id);
  if (error) throw error;

  // Notify all technicians and managers
  if (block) {
    const blockData = block as AvailabilityBlock & { technician: User };
    await notifyAvailabilityBlockDeleted(
      blockData.technician?.name || 'Unknown',
      formatEST(blockData.start_time, 'MMM d, h:mm a'),
      formatEST(blockData.end_time, 'h:mm a')
    );
  }
}

export async function getAllAvailabilityBlocks(startDate?: string, endDate?: string) {
  let query = supabase
    .from('ss_availability_blocks')
    .select('*, technician:ss_users(*)')
    .order('start_time');

  if (startDate) query = query.gte('start_time', startDate);
  if (endDate) query = query.lte('end_time', endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data as (AvailabilityBlock & { technician: User })[];
}
