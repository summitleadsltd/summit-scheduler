import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores/authStore';
import { AuthGuard } from '@/components/shared/AuthGuard';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { usePWAStore } from '@/stores/pwaStore';
import { SplashScreen } from '@/components/pwa/SplashScreen';
// import { onForegroundMessage } from '@/lib/firebase';
import { toast } from 'sonner';

// Auth
import { LoginPage } from '@/pages/auth/LoginPage';
// import { GoogleCallback } from '@/pages/auth/GoogleCallback';

// Technician
import { TechnicianDashboard } from '@/pages/technician/TechnicianDashboard';
const TechnicianCalendar = lazy(() => import('@/pages/technician/TechnicianCalendar').then(m => ({ default: m.TechnicianCalendar })));
const TechnicianRouteMap = lazy(() => import('@/pages/technician/TechnicianRouteMap').then(m => ({ default: m.TechnicianRouteMap })));
import { TechnicianAvailability } from '@/pages/technician/TechnicianAvailability';

// Scheduler
import { SchedulerDashboard } from '@/pages/scheduler/SchedulerDashboard';
import { CreateBooking } from '@/pages/scheduler/CreateBooking';
const SchedulerCalendar = lazy(() => import('@/pages/scheduler/SchedulerCalendar').then(m => ({ default: m.SchedulerCalendar })));
import { CustomersPage } from '@/pages/scheduler/CustomersPage';

// Manager
import { ManagerDashboard } from '@/pages/manager/ManagerDashboard';
import { DispatchBoard } from '@/pages/manager/DispatchBoard';
const ManagerCalendar = lazy(() => import('@/pages/manager/ManagerCalendar').then(m => ({ default: m.ManagerCalendar })));
import { TechnicianManagement } from '@/pages/manager/TechnicianManagement';
import { SchedulerManagement } from '@/pages/manager/SchedulerManagement';
import { ReportsPage } from '@/pages/manager/ReportsPage';
import { SettingsPage } from '@/pages/manager/SettingsPage';

// Admin
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { UserManagement } from '@/pages/admin/UserManagement';

// Shared
const TeamCalendar = lazy(() => import('@/pages/shared/TeamCalendar').then(m => ({ default: m.TeamCalendar })));
import { NotificationCenter } from '@/pages/shared/NotificationCenter';
import { AccountSettings } from '@/pages/shared/AccountSettings';

// Legal
import { PrivacyPolicy } from '@/pages/legal/PrivacyPolicy';
import { TermsOfService } from '@/pages/legal/TermsOfService';

// Loading fallback for lazy-loaded components
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function AppRoutes() {
  const { profile } = useAuthStore();

  const defaultRoute = profile
    ? profile.role === 'admin'
      ? '/admin/dashboard'
      : profile.role === 'manager'
        ? '/manager/dashboard'
        : profile.role === 'scheduler'
          ? '/scheduler/dashboard'
          : '/technician/dashboard'
    : '/login';

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* <Route path="/auth/google/callback" element={<GoogleCallback />} /> */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />

      {/* Technician Portal */}
      <Route
        element={
          <AuthGuard allowedRoles={['technician']}>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/technician/dashboard" element={<TechnicianDashboard />} />
        <Route path="/technician/calendar" element={<Suspense fallback={<LoadingFallback />}><TechnicianCalendar /></Suspense>} />
        <Route path="/technician/route" element={<Suspense fallback={<LoadingFallback />}><TechnicianRouteMap /></Suspense>} />
        <Route path="/technician/availability" element={<TechnicianAvailability />} />
        <Route path="/technician/booking" element={<CreateBooking />} />
        <Route path="/technician/team-calendar" element={<Suspense fallback={<LoadingFallback />}><TeamCalendar /></Suspense>} />
        <Route path="/technician/notifications" element={<NotificationCenter />} />
        <Route path="/technician/account" element={<AccountSettings />} />
      </Route>

      {/* Scheduler Portal */}
      <Route
        element={
          <AuthGuard allowedRoles={['scheduler']}>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/scheduler/dashboard" element={<SchedulerDashboard />} />
        <Route path="/scheduler/booking" element={<CreateBooking />} />
        <Route path="/scheduler/calendar" element={<Suspense fallback={<LoadingFallback />}><SchedulerCalendar /></Suspense>} />
        <Route path="/scheduler/customers" element={<CustomersPage />} />
        <Route path="/scheduler/team-calendar" element={<Suspense fallback={<LoadingFallback />}><TeamCalendar /></Suspense>} />
        <Route path="/scheduler/notifications" element={<NotificationCenter />} />
        <Route path="/scheduler/account" element={<AccountSettings />} />
      </Route>

      {/* Shared Appointment Management - All authenticated users */}
      <Route
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/booking" element={<CreateBooking />} />
        <Route path="/calendar" element={<Suspense fallback={<LoadingFallback />}><TeamCalendar /></Suspense>} />
      </Route>

      {/* Manager Portal */}
      <Route
        element={
          <AuthGuard allowedRoles={['manager']}>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/manager/dashboard" element={<ManagerDashboard />} />
        <Route path="/manager/booking" element={<CreateBooking />} />
        <Route path="/manager/dispatch" element={<DispatchBoard />} />
        <Route path="/manager/calendar" element={<Suspense fallback={<LoadingFallback />}><ManagerCalendar /></Suspense>} />
        <Route path="/manager/technicians" element={<TechnicianManagement />} />
        <Route path="/manager/schedulers" element={<SchedulerManagement />} />
        <Route path="/manager/customers" element={<CustomersPage />} />
        <Route path="/manager/reports" element={<ReportsPage />} />
        <Route path="/manager/settings" element={<SettingsPage />} />
        <Route path="/manager/team-calendar" element={<Suspense fallback={<LoadingFallback />}><TeamCalendar /></Suspense>} />
        <Route path="/manager/notifications" element={<NotificationCenter />} />
        <Route path="/manager/account" element={<AccountSettings />} />
      </Route>

      {/* Admin Portal */}
      <Route
        element={
          <AuthGuard allowedRoles={['admin']}>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/booking" element={<CreateBooking />} />
        <Route path="/admin/dispatch" element={<DispatchBoard />} />
        <Route path="/admin/calendar" element={<Suspense fallback={<LoadingFallback />}><ManagerCalendar /></Suspense>} />
        <Route path="/admin/customers" element={<CustomersPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        <Route path="/admin/team-calendar" element={<Suspense fallback={<LoadingFallback />}><TeamCalendar /></Suspense>} />
        <Route path="/admin/notifications" element={<NotificationCenter />} />
        <Route path="/admin/account" element={<AccountSettings />} />
      </Route>

      <Route path="*" element={<Navigate to={defaultRoute} replace />} />
    </Routes>
  );
}

export default function App() {
  const { initialize, initialized } = useAuthStore();
  const { setDeferredPrompt, setIsOnline, setNeedsUpdate, setUpdateSW } = usePWAStore();

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      setNeedsUpdate(true);
    },
    onOfflineReady() {
      toast.info('App ready for offline use');
    },
  });

  useEffect(() => {
    setUpdateSW(() => updateServiceWorker(true));
  }, [updateServiceWorker, setUpdateSW]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, [setDeferredPrompt]);

  useEffect(() => {
    // onForegroundMessage((payload) => {
    //   toast(payload.title ?? 'Notification', {
    //     description: payload.body,
    //   });
    // });
  }, []);

  if (!initialized) {
    return <SplashScreen />;
  }

  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
