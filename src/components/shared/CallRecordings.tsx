import { useEffect, useState } from 'react';
import { uploadCallRecording, getCallRecordings, deleteCallRecording, getRecordingUrl } from '@/services/callRecordingService';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Phone, Upload, Trash2, Play, Pause, Clock, FileAudio } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface CallRecordingsProps {
  appointmentId: string;
}

export function CallRecordings({ appointmentId }: CallRecordingsProps) {
  const { profile } = useAuthStore();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    loadRecordings();
  }, [appointmentId]);

  const loadRecordings = async () => {
    try {
      const data = await getCallRecordings(appointmentId);
      setRecordings(data);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !profile) return;
    setUploading(true);
    try {
      await uploadCallRecording({
        appointmentId,
        file: selectedFile,
        userId: profile.id,
        userName: profile.name,
        notes: notes || undefined,
      });
      toast.success('Call recording uploaded successfully');
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setNotes('');
      await loadRecordings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload recording');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (recordingId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;
    if (!profile) return;
    try {
      await deleteCallRecording(recordingId, profile.id, profile.name);
      toast.success('Recording deleted');
      await loadRecordings();
    } catch (error) {
      toast.error('Failed to delete recording');
    }
  };

  const handlePlayPause = async (recording: any) => {
    if (playingId === recording.id) {
      setPlayingId(null);
      return;
    }

    try {
      const url = await getRecordingUrl(recording.id);
      const audio = new Audio(url);
      audio.onended = () => setPlayingId(null);
      audio.play();
      setPlayingId(recording.id);
    } catch (error) {
      toast.error('Failed to play recording');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading recordings...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call Recordings
          </CardTitle>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger>
              <Button size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Call Recording</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Audio File</Label>
                  <Input
                    type="file"
                    accept=".mp3,.wav,.m4a,.aac,.mp4,audio/*"
                    onChange={handleFileSelect}
                  />
                  <p className="text-xs text-muted-foreground">
                    Supported formats: MP3, WAV, M4A, AAC, MP4
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this recording..."
                  />
                </div>
                <Button onClick={handleUpload} disabled={!selectedFile || uploading} className="w-full">
                  {uploading ? 'Uploading...' : 'Upload Recording'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {recordings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileAudio className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No call recordings yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recordings.map((recording) => (
              <div key={recording.id} className="flex items-center gap-3 p-3 border rounded-lg">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => handlePlayPause(recording)}
                >
                  {playingId === recording.id ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{recording.file_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {recording.duration_seconds ? formatDuration(recording.duration_seconds) : 'Unknown'}
                    </span>
                    <span>{formatFileSize(recording.file_size)}</span>
                    <span>{formatDistanceToNow(new Date(recording.uploaded_at), { addSuffix: true })}</span>
                  </div>
                  {recording.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{recording.notes}</p>
                  )}
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(recording.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
