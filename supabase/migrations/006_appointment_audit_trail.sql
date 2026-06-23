-- Appointment Audit Trail Migration
-- Tracks all changes to appointments for audit purposes

CREATE TABLE IF NOT EXISTS ss_appointment_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES ss_appointments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES ss_users(id) ON DELETE SET NULL,
  user_name TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created',
    'updated',
    'deleted',
    'rescheduled',
    'reassigned',
    'status_changed',
    'file_uploaded',
    'call_recording_added',
    'note_added'
  )),
  old_value JSONB,
  new_value JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_activity_log_appointment_id 
  ON ss_appointment_activity_log(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_activity_log_user_id 
  ON ss_appointment_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_appointment_activity_log_action_type 
  ON ss_appointment_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_appointment_activity_log_created_at 
  ON ss_appointment_activity_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE ss_appointment_activity_log ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON ss_appointment_activity_log TO authenticated;
GRANT INSERT ON ss_appointment_activity_log TO authenticated;
GRANT UPDATE ON ss_appointment_activity_log TO authenticated;

-- Policies: All authenticated users can read activity logs
CREATE POLICY "Users can view appointment activity logs"
  ON ss_appointment_activity_log FOR SELECT
  TO authenticated
  USING (true);

-- Policies: All authenticated users can insert activity logs
CREATE POLICY "Users can insert appointment activity logs"
  ON ss_appointment_activity_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE ss_appointment_activity_log IS 'Audit trail for all appointment changes and actions';
COMMENT ON COLUMN ss_appointment_activity_log.action_type IS 'Type of action performed on the appointment';
COMMENT ON COLUMN ss_appointment_activity_log.old_value IS 'Previous state of the changed data';
COMMENT ON COLUMN ss_appointment_activity_log.new_value IS 'New state of the changed data';
COMMENT ON COLUMN ss_appointment_activity_log.metadata IS 'Additional context about the action (e.g., file name, reason)';
