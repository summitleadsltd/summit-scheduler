import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import type { UserRole } from '@/types/database';

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAllRoles?: boolean;
}

export function AuthGuard({ children, allowedRoles, requireAllRoles = false }: AuthGuardProps) {
  const { profile, initialized } = useAuthStore();

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles) {
    const hasAccess = requireAllRoles
      ? allowedRoles.every(role => profile.role === role)
      : allowedRoles.includes(profile.role);
    
    if (!hasAccess) {
      const defaultRoute =
        profile.role === 'admin'
          ? '/admin/dashboard'
          : profile.role === 'manager'
            ? '/manager/dashboard'
            : profile.role === 'scheduler'
              ? '/scheduler/dashboard'
              : '/technician/dashboard';
      return <Navigate to={defaultRoute} replace />;
    }
  }

  return <>{children}</>;
}
