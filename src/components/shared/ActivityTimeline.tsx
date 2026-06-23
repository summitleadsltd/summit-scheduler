import { useEffect, useState } from 'react';
import { getAppointmentActivityLog } from '@/services/auditTrailService';
import { formatEST } from '@/lib/timezone';
import { Clock, FileText, Calendar, UserPlus, Trash2, Edit, Phone, CheckCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const actionIcons: Record<string, any> = {
  created: Calendar,
  updated: Edit,
  deleted: Trash2,
  rescheduled: Calendar,
  reassigned: UserPlus,
  status_changed: CheckCircle,
  file_uploaded: FileText,
  call_recording_added: Phone,
  note_added: FileText,
};

const actionLabels: Record<string, string> = {
  created: 'Created appointment',
  updated: 'Updated appointment',
  deleted: 'Deleted appointment',
  rescheduled: 'Rescheduled appointment',
  reassigned: 'Reassigned technician',
  status_changed: 'Changed status',
  file_uploaded: 'Uploaded file',
  call_recording_added: 'Added call recording',
  note_added: 'Added note',
};

interface ActivityTimelineProps {
  appointmentId: string;
}

export function ActivityTimeline({ appointmentId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      try {
        const data = await getAppointmentActivityLog(appointmentId);
        setActivities(data);
      } catch (error) {
        console.error('Failed to load activity log:', error);
      } finally {
        setLoading(false);
      }
    }
    loadActivities();
  }, [appointmentId]);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading activity...</div>;
  }

  if (activities.length === 0) {
    return <div className="text-sm text-muted-foreground">No activity recorded yet.</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-4">
            {activities.map((activity, index) => {
              const Icon = actionIcons[activity.action_type] || Clock;
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    {index < activities.length - 1 && (
                      <div className="w-px h-full bg-border mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {actionLabels[activity.action_type] || activity.action_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatEST(activity.created_at, 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      by {activity.user_name || 'Unknown'}
                    </p>
                    {(activity.old_value || activity.new_value) && (
                      <div className="mt-2 text-xs bg-muted/50 p-2 rounded">
                        {activity.old_value && (
                          <div className="text-muted-foreground">
                            <span className="font-medium">Before:</span>{' '}
                            {JSON.stringify(activity.old_value, null, 2)}
                          </div>
                        )}
                        {activity.new_value && (
                          <div className="text-muted-foreground mt-1">
                            <span className="font-medium">After:</span>{' '}
                            {JSON.stringify(activity.new_value, null, 2)}
                          </div>
                        )}
                      </div>
                    )}
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {Object.entries(activity.metadata).map(([key, value]) => (
                          <div key={key}>
                            <span className="font-medium">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
