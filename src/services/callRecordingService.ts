import { supabase } from '@/lib/supabase';
import { logAppointmentActivity } from './auditTrailService';
import { notifyCallRecordingAdded, notifyCallRecordingDeleted } from './notificationService';
import { getAppointment } from './appointmentService';

const BUCKET_NAME = 'call-recordings';

export async function uploadCallRecording(params: {
  appointmentId: string;
  file: File;
  userId: string;
  userName: string;
  notes?: string;
}) {
  const { appointmentId, file, userId, userName, notes } = params;

  // Validate file type
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/aac', 'audio/x-m4a'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Allowed types: MP3, WAV, M4A, AAC, MP4');
  }

  // Generate unique file path
  const fileExt = file.name.split('.').pop();
  const fileName = `${appointmentId}/${Date.now()}.${fileExt}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase
    .storage
    .from(BUCKET_NAME)
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  // Get audio duration (using Audio API)
  const duration = await getAudioDuration(file);

  // Save to database
  const { data, error } = await supabase
    .from('ss_call_recordings')
    .insert({
      appointment_id: appointmentId,
      file_name: file.name,
      file_path: fileName,
      file_size: file.size,
      file_type: file.type,
      duration_seconds: duration,
      uploaded_by: userId,
      notes,
    })
    .select()
    .single();

  if (error) throw error;

  // Get appointment details for notification
  const appointment = await getAppointment(appointmentId);

  // Log audit trail
  await logAppointmentActivity({
    appointment_id: appointmentId,
    user_id: userId,
    user_name: userName,
    action_type: 'call_recording_added',
    metadata: {
      file_name: file.name,
      file_size: file.size,
      duration_seconds: duration,
    },
  });

  // Notify technician
  if (appointment) {
    await notifyCallRecordingAdded(
      appointment.technician_id,
      `${appointment.customer?.first_name} ${appointment.customer?.last_name}`,
      file.name
    );
  }

  return data;
}

export async function getCallRecordings(appointmentId: string) {
  const { data, error } = await supabase
    .from('ss_call_recordings')
    .select('*')
    .eq('appointment_id', appointmentId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteCallRecording(recordingId: string, userId: string, userName: string) {
  // Get recording details
  const { data: recording } = await supabase
    .from('ss_call_recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (!recording) throw new Error('Recording not found');

  // Delete from storage
  const { error: storageError } = await supabase
    .storage
    .from(BUCKET_NAME)
    .remove([recording.file_path]);

  if (storageError) throw storageError;

  // Delete from database
  const { error } = await supabase
    .from('ss_call_recordings')
    .delete()
    .eq('id', recordingId);

  if (error) throw error;

  // Get appointment details for notification
  const appointment = await getAppointment(recording.appointment_id);

  // Log audit trail
  await logAppointmentActivity({
    appointment_id: recording.appointment_id,
    user_id: userId,
    user_name: userName,
    action_type: 'deleted',
    metadata: {
      file_name: recording.file_name,
    },
  });

  // Notify technician
  if (appointment) {
    await notifyCallRecordingDeleted(
      appointment.technician_id,
      `${appointment.customer?.first_name} ${appointment.customer?.last_name}`,
      recording.file_name
    );
  }
}

export async function getRecordingUrl(recordingId: string) {
  const { data: recording } = await supabase
    .from('ss_call_recordings')
    .select('file_path')
    .eq('id', recordingId)
    .single();

  if (!recording) throw new Error('Recording not found');

  const { data } = supabase
    .storage
    .from(BUCKET_NAME)
    .getPublicUrl(recording.file_path);

  return data.publicUrl;
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };
    audio.onerror = () => {
      reject(new Error('Failed to load audio'));
    };
    audio.src = URL.createObjectURL(file);
  });
}
