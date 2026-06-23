-- Call Recordings Migration
-- Stores call recording files linked to appointments

CREATE TABLE IF NOT EXISTS ss_call_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES ss_appointments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  duration_seconds INTEGER,
  uploaded_by UUID REFERENCES ss_users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_recordings_appointment_id 
  ON ss_call_recordings(appointment_id);
CREATE INDEX IF NOT EXISTS idx_call_recordings_uploaded_by 
  ON ss_call_recordings(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_call_recordings_uploaded_at 
  ON ss_call_recordings(uploaded_at DESC);

-- Enable Row Level Security
ALTER TABLE ss_call_recordings ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON ss_call_recordings TO authenticated;
GRANT INSERT ON ss_call_recordings TO authenticated;
GRANT UPDATE ON ss_call_recordings TO authenticated;
GRANT DELETE ON ss_call_recordings TO authenticated;

-- Policies: All authenticated users can read call recordings
CREATE POLICY "Users can view call recordings"
  ON ss_call_recordings FOR SELECT
  TO authenticated
  USING (true);

-- Policies: All authenticated users can insert call recordings
CREATE POLICY "Users can insert call recordings"
  ON ss_call_recordings FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies: All authenticated users can update call recordings
CREATE POLICY "Users can update call recordings"
  ON ss_call_recordings FOR UPDATE
  TO authenticated
  USING (true);

-- Policies: All authenticated users can delete call recordings
CREATE POLICY "Users can delete call recordings"
  ON ss_call_recordings FOR DELETE
  TO authenticated
  USING (true);

-- Comment
COMMENT ON TABLE ss_call_recordings IS 'Call recording files linked to appointments';
COMMENT ON COLUMN ss_call_recordings.file_type IS 'MIME type of the audio file (audio/mpeg, audio/wav, audio/mp4, etc.)';
COMMENT ON COLUMN ss_call_recordings.duration_seconds IS 'Duration of the call recording in seconds';
