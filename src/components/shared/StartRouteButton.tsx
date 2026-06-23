import { Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openNavigation, formatAddress } from '@/services/navigationService';
import type { Appointment } from '@/types/database';

interface StartRouteButtonProps {
  appointment: Appointment;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function StartRouteButton({ 
  appointment, 
  variant = 'default',
  size = 'default',
  className = ''
}: StartRouteButtonProps) {
  const handleClick = () => {
    if (appointment.address) {
      const address = formatAddress(appointment.address);
      openNavigation(address);
    }
  };

  if (!appointment.address) {
    return null;
  }

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={className}
    >
      <Navigation className="h-4 w-4 mr-2" />
      Start Route
    </Button>
  );
}
