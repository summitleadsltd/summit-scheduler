import { useEffect, useState, useCallback } from 'react';
import { getAppointments } from '@/services/appointmentService';
import { getAllAvailabilityBlocks, getTechnicians } from '@/services/technicianService';
import { supabase } from '@/lib/supabase';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppointmentStatusBadge } from '@/components/shared/AppointmentStatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatEST } from '@/lib/timezone';
import { addDays } from 'date-fns';
import type { Appointment, User } from '@/types/database';

const statusColors: Record<string, string> = {
  scheduled: '#3b82f6',
  in_progress: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#ef4444',
  no_show: '#6b7280',
};

export function SchedulerCalendar() {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [filterTechId, setFilterTechId] = useState<string>('all');

  const loadAppointments = useCallback(async () => {
    // Load technicians
    const techs = await getTechnicians();
    setTechnicians(techs);

    // Load appointments based on filter
    const data = filterTechId === 'all' 
      ? await getAppointments()
      : await getAppointments({ technician_id: filterTechId });
    setAppointments(data);

    // Load all availability blocks
    const now = new Date();
    const availabilityBlocks = await getAllAvailabilityBlocks(
      now.toISOString(),
      addDays(now, 30).toISOString()
    );

    // Map appointments to calendar events
    const appointmentEvents: EventInput[] = data.map((apt) => ({
      id: apt.id,
      title: `${apt.customer?.first_name} ${apt.customer?.last_name} - ${apt.technician?.name}`,
      start: apt.start_time,
      end: apt.end_time,
      backgroundColor: statusColors[apt.status] || '#3b82f6',
      borderColor: statusColors[apt.status] || '#3b82f6',
      extendedProps: { type: 'appointment', technicianId: apt.technician_id },
    }));

    // Map availability blocks to calendar events
    const availabilityEvents: EventInput[] = availabilityBlocks.map((block) => ({
      id: `avail-${block.id}`,
      title: 'Unavailable',
      start: block.start_time,
      end: block.end_time,
      display: 'background',
      color: '#ef4444',
      extendedProps: { type: 'availability', technicianId: block.technician_id, technicianName: block.technician?.name, reason: block.reason },
    }));

    setEvents([...appointmentEvents, ...availabilityEvents]);
  }, [filterTechId]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Set up realtime subscription for availability blocks
  useEffect(() => {
    const subscription = supabase
      .channel('scheduler-availability-blocks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ss_availability_blocks',
        },
        () => {
          // Reload appointments and availability blocks when changes occur
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadAppointments]);

  // Set up realtime subscription for appointments
  useEffect(() => {
    const subscription = supabase
      .channel('scheduler-appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ss_appointments',
        },
        () => {
          // Reload appointments when changes occur
          loadAppointments();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [loadAppointments]);

  const handleEventClick = (info: EventClickArg) => {
    const apt = appointments.find((a) => a.id === info.event.id);
    if (apt) setSelectedAppointment(apt);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Select value={filterTechId} onValueChange={setFilterTechId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by technician" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Technicians</SelectItem>
            {technicians.map((tech) => (
              <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            events={events}
            eventClick={handleEventClick}
            slotMinTime="09:00:00"
            slotMaxTime="19:00:00"
            allDaySlot={false}
            hiddenDays={[0, 6]}
            businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '19:00' }}
            height="auto"
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedAppointment} onOpenChange={() => setSelectedAppointment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {selectedAppointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">
                    {selectedAppointment.customer?.first_name}{' '}
                    {selectedAppointment.customer?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <AppointmentStatusBadge status={selectedAppointment.status} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Technician</p>
                  <p className="font-medium">{selectedAppointment.technician?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{selectedAppointment.appointment_type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {formatEST(selectedAppointment.start_time, 'MMM d, h:mm a')} -{' '}
                    {formatEST(selectedAppointment.end_time, 'h:mm a')}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{selectedAppointment.address?.address_line}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
