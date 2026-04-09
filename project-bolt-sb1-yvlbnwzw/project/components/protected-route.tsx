'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, ShieldAlert } from 'lucide-react';

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedAccountTypes?: Array<'professional' | 'customer'>;
};

export function ProtectedRoute({
  children,
  requireAuth = true,
  allowedAccountTypes
}: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is logged in — show immediately
        setAuthChecked(true);
        if (allowedAccountTypes && profile && !allowedAccountTypes.includes(profile.account_type)) {
          setShouldRedirect(true);
        }
      } else {
        // No user yet — wait a bit longer before showing error (session may still be restoring)
        const timer = setTimeout(() => {
          setAuthChecked(true);
          if (requireAuth) setShouldRedirect(true);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [user, profile, loading, requireAuth, allowedAccountTypes]);

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (requireAuth && !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
              <p className="text-muted-foreground mb-6">
                You need to be logged in to access this page.
              </p>
              <div className="flex gap-2 w-full">
                <Button onClick={() => router.push('/login')} className="flex-1">
                  Go to Login
                </Button>
                <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
                  Go Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (shouldRedirect && allowedAccountTypes && profile && !allowedAccountTypes.includes(profile.account_type)) {
    const isCustomerOnly = allowedAccountTypes.includes('customer') && !allowedAccountTypes.includes('professional');
    const isProfessionalOnly = allowedAccountTypes.includes('professional') && !allowedAccountTypes.includes('customer');

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <ShieldAlert className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground mb-6">
                {isCustomerOnly && (
                  <>This page is only available to customers. As a professional, you can browse available jobs instead.</>
                )}
                {isProfessionalOnly && (
                  <>This page is only available to professionals. As a customer, you can post jobs or find professionals.</>
                )}
              </p>
              <div className="flex gap-2 w-full">
                <Button onClick={() => router.push('/dashboard')} className="flex-1">
                  Go to Dashboard
                </Button>
                {isCustomerOnly && (
                  <Button onClick={() => router.push('/jobs')} variant="outline" className="flex-1">
                    Browse Jobs
                  </Button>
                )}
                {isProfessionalOnly && (
                  <Button onClick={() => router.push('/jobs')} variant="outline" className="flex-1">
                    Browse Jobs
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
