import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/authStore';
import { geocodeAddress } from '@/services/geocodingService';
import { findBestSlots } from '@/services/schedulingEngine';
import { createCustomer, createAddress, searchCustomers } from '@/services/customerService';
import { createAppointment } from '@/services/appointmentService';
import { notifyNewAppointment } from '@/services/notificationService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatEST } from '@/lib/timezone';
import { Star, MapPin, Clock, Search, CheckCircle, ArrowRight, ArrowLeft, User, FileText } from 'lucide-react';
import type { SchedulingSlot, Customer, Address } from '@/types/database';
import { toast } from 'sonner';

const addressSchema = z.object({
  address: z.string().min(1, 'Required'),
  zip_code: z.string().min(5, 'ZIP code must be at least 5 characters'),
});

const customerInfoSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  phone: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  appointment_type: z.string().min(1, 'Required'),
  duration: z.number().min(15).max(480),
  notes: z.string().optional(),
});

type AddressForm = z.infer<typeof addressSchema>;
type CustomerInfoForm = z.infer<typeof customerInfoSchema>;

export function CreateBooking() {
  const { profile } = useAuthStore();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [slots, setSlots] = useState<SchedulingSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SchedulingSlot | null>(null);
  const [searching, setSearching] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<(Customer & { addresses: Address[] })[]>([]);
  const [geocodedAddress, setGeocodedAddress] = useState<{ lat: number; lng: number; display: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);

  const {
    register: registerAddress,
    handleSubmit: handleSubmitAddress,
    getValues: getAddressValues,
    formState: { errors: addressErrors },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
  });

  const {
    register: registerCustomer,
    handleSubmit: handleSubmitCustomer,
    setValue: setCustomerValue,
    getValues: getCustomerValues,
    formState: { errors: customerErrors },
  } = useForm<CustomerInfoForm>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: { duration: 60 },
  });

  const handleCustomerSearch = async () => {
    if (customerSearch.length < 2) return;
    setSearching(true);
    try {
      const results = await searchCustomers(customerSearch);
      setSearchResults(results);
    } finally {
      setSearching(false);
    }
  };

  const selectExistingCustomer = (customer: Customer & { addresses: Address[] }) => {
    setCustomerValue('first_name', customer.first_name);
    setCustomerValue('last_name', customer.last_name);
    setCustomerValue('phone', customer.phone);
    setCustomerValue('email', customer.email);
    setExistingCustomer(customer);
    setSearchResults([]);
    setCustomerSearch('');
  };

  // Step 1: Address only
  const handleAddressSubmit = async (data: AddressForm) => {
    setSearching(true);
    try {
      const fullAddress = `${data.address}, ${data.zip_code}`;
      const geo = await geocodeAddress(fullAddress);
      if (!geo) {
        toast.error('Could not geocode address. Please check and try again.');
        return;
      }
      setGeocodedAddress({ lat: geo.latitude, lng: geo.longitude, display: geo.display_name });
      setStep(2);
    } catch {
      toast.error('Failed to geocode address');
    } finally {
      setSearching(false);
    }
  };

  // Step 2: Find best slots
  const findSlots = async () => {
    if (!geocodedAddress) return;
    setSearching(true);
    try {
      const customerData = getCustomerValues();
      const bestSlots = await findBestSlots(geocodedAddress.lat, geocodedAddress.lng, customerData.duration || 60);
      if (bestSlots.length === 0) {
        toast.error('No available slots found. Try adjusting the duration or check back later.');
        return;
      }
      setSlots(bestSlots);
      setStep(3);
    } catch {
      toast.error('Failed to find available slots');
    } finally {
      setSearching(false);
    }
  };

  // Step 3: Select slot
  const selectSlot = (slot: SchedulingSlot) => {
    setSelectedSlot(slot);
    setStep(4);
  };

  // Step 4: Customer info
  const handleCustomerSubmit = async () => {
    setStep(5);
  };

  // Step 5: Confirm and create
  const confirmBooking = async () => {
    if (!selectedSlot || !profile || !geocodedAddress) return;
    setSubmitting(true);

    try {
      const customerData = getCustomerValues();
      const addressData = getAddressValues();

      // Create or use existing customer
      let customer;
      if (existingCustomer) {
        customer = existingCustomer;
      } else {
        customer = await createCustomer({
          first_name: customerData.first_name,
          last_name: customerData.last_name,
          phone: customerData.phone,
          email: customerData.email,
        });
      }

      // Create address
      const fullAddress = `${addressData.address}, ${addressData.zip_code}`;
      const addressParts = fullAddress.split(',').map((p) => p.trim());
      const address = await createAddress({
        customer_id: customer.id,
        address_line: addressParts[0] || fullAddress,
        city: addressParts[1] || '',
        state: addressParts[2]?.split(' ')[0] || '',
        zip_code: addressData.zip_code,
        latitude: geocodedAddress.lat,
        longitude: geocodedAddress.lng,
      });

      // Create appointment
      const appointment = await createAppointment({
        customer_id: customer.id,
        technician_id: selectedSlot.technician_id,
        address_id: address.id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        appointment_type: customerData.appointment_type,
        notes: customerData.notes || '',
        created_by: profile.id,
      }, { id: profile.id, name: profile.name });

      // Send notification
      await notifyNewAppointment(
        selectedSlot.technician_id,
        `${customerData.first_name} ${customerData.last_name}`,
        formatEST(selectedSlot.start_time, 'MMM d, h:mm a'),
        appointment.id,
      );

      toast.success('Appointment booked successfully!');
      setStep(6);
    } catch {
      toast.error('Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSlots([]);
    setSelectedSlot(null);
    setGeocodedAddress(null);
    setExistingCustomer(null);
    setSearchResults([]);
  };

  const goBack = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3 | 4 | 5);
  };

  // Step 5: Review and confirm
  if (step === 5 && selectedSlot) {
    const customerData = getCustomerValues();
    const addressData = getAddressValues();
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Review Booking</h1>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Appointment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Date & Time</p>
                <p className="font-medium">
                  {formatEST(selectedSlot.start_time, 'EEE, MMM d, yyyy at h:mm a')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Technician</p>
                <p className="font-medium">{selectedSlot.technician_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Service Type</p>
                <p className="font-medium capitalize">{customerData.appointment_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{customerData.duration} minutes</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">
                {customerData.first_name} {customerData.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{customerData.phone}</p>
              <p className="text-sm text-muted-foreground">{customerData.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Service Address</p>
              <p className="font-medium">{addressData.address}, {addressData.zip_code}</p>
            </div>
            {customerData.notes && (
              <div>
                <p className="text-sm text-muted-foreground">Notes</p>
                <p className="text-sm">{customerData.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button size="lg" onClick={confirmBooking} disabled={submitting} className="w-full">
          {submitting ? 'Creating Booking...' : 'Confirm Booking'}
        </Button>
      </div>
    );
  }

  // Step 6: Confirmed
  if (step === 6 && selectedSlot) {
    return (
      <div className="max-w-lg mx-auto mt-12 text-center space-y-4">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold">Booking Confirmed!</h2>
        <p className="text-muted-foreground">
          Appointment has been scheduled with {selectedSlot.technician_name} on{' '}
          {formatEST(selectedSlot.start_time, 'EEEE, MMM d, yyyy at h:mm a')}
        </p>
        <Button onClick={resetForm}>Create Another Booking</Button>
      </div>
    );
  }

  // Step 3: Select slot
  if (step === 3) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Select Appointment Slot</h1>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {geocodedAddress && (
          <Card>
            <CardContent className="p-4 flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{geocodedAddress.display}</span>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slots.map((slot, index) => (
            <Card
              key={index}
              className="cursor-pointer transition-all hover:shadow-md"
              onClick={() => selectSlot(slot)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">
                    {formatEST(slot.start_time, 'EEE, MMM d')}
                  </p>
                  <div className="flex">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${
                          i < slot.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-lg font-bold text-primary">
                  {formatEST(slot.start_time, 'h:mm a')}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{slot.technician_name}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.round(slot.travel_time_before)}min travel
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {slot.distance_before.toFixed(1)}km
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Step 4: Customer info
  if (step === 4) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Customer Information</h1>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Customer Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Search Existing Customer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Search by name, email, or phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCustomerSearch()}
              />
              <Button variant="outline" onClick={handleCustomerSearch} disabled={searching}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-3 border rounded-md divide-y">
                {searchResults.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 cursor-pointer hover:bg-muted/50"
                    onClick={() => selectExistingCustomer(c)}
                  >
                    <p className="font-medium text-sm">
                      {c.first_name} {c.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.email} | {c.phone}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <form onSubmit={handleSubmitCustomer(handleCustomerSubmit)}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Customer Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input {...registerCustomer('first_name')} />
                    {customerErrors.first_name && <p className="text-xs text-destructive">{customerErrors.first_name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input {...registerCustomer('last_name')} />
                    {customerErrors.last_name && <p className="text-xs text-destructive">{customerErrors.last_name.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input {...registerCustomer('phone')} />
                    {customerErrors.phone && <p className="text-xs text-destructive">{customerErrors.phone.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" {...registerCustomer('email')} />
                    {customerErrors.email && <p className="text-xs text-destructive">{customerErrors.email.message}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Service Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Appointment Type</Label>
                    <Select onValueChange={(v: unknown) => setCustomerValue('appointment_type', v as string)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="installation">Installation</SelectItem>
                        <SelectItem value="repair">Repair</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="inspection">Inspection</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                      </SelectContent>
                    </Select>
                    {customerErrors.appointment_type && <p className="text-xs text-destructive">{customerErrors.appointment_type.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input
                      type="number"
                      {...registerCustomer('duration', { valueAsNumber: true })}
                    />
                    {customerErrors.duration && <p className="text-xs text-destructive">{customerErrors.duration.message}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea {...registerCustomer('notes')} placeholder="Any special instructions..." />
                </div>
              </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full">
              Review Booking
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Step 2: Service type and duration
  if (step === 2) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Service Details</h1>
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {geocodedAddress && (
          <Card>
            <CardContent className="p-4 flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span>{geocodedAddress.display}</span>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Appointment Type & Duration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Appointment Type</Label>
              <Select onValueChange={(v: unknown) => setCustomerValue('appointment_type', v as string)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="installation">Installation</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="consultation">Consultation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                {...registerCustomer('duration', { valueAsNumber: true })}
              />
            </div>
            <Button onClick={findSlots} size="lg" className="w-full" disabled={searching}>
              {searching ? 'Finding Best Slots...' : 'Find Available Slots'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 1: Address only
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create Booking</h1>
      <p className="text-muted-foreground">Step 1 of 5: Enter service address</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Service Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmitAddress(handleAddressSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Street Address</Label>
              <Input
                {...registerAddress('address')}
                placeholder="123 Main Street"
              />
              {addressErrors.address && <p className="text-xs text-destructive">{addressErrors.address.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>ZIP Code</Label>
              <Input
                {...registerAddress('zip_code')}
                placeholder="12345"
              />
              {addressErrors.zip_code && <p className="text-xs text-destructive">{addressErrors.zip_code.message}</p>}
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={searching}>
              {searching ? 'Geocoding...' : 'Continue'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
