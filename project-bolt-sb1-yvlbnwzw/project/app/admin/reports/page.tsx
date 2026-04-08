'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/auth-context';
import { supabase } from '@/lib/supabase/client';
import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

type Report = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  reporter: {
    id: string;
    name: string;
  };
  target_owner: {
    id: string;
    name: string;
  };
};

function AdminReportsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchReports();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user!.id)
        .single() as { data: { is_admin: boolean } | null };

      const adminStatus = profile?.is_admin === true;
      setIsAdmin(adminStatus);

      if (!adminStatus) {
        toast.error('Access denied: Admin privileges required');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    } finally {
      setCheckingAdmin(false);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        setLoading(false);
        return;
      }

      const response = await fetch('/api/reports', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`
        }
      });

      if (response.ok) {
        const { data } = await response.json();
        setReports(data || []);
      } else {
        toast.error('Failed to load reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reportId: string, newStatus: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.access_token) {
        toast.error('Unauthorized');
        return;
      }

      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        toast.success('Report status updated');
        fetchReports();
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating report status:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'open':
        return 'destructive';
      case 'reviewed':
        return 'default';
      case 'resolved':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getReasonLabel = (reason: string) => {
    const labels: { [key: string]: string } = {
      spam: 'Spam',
      scam: 'Scam/Fraud',
      harassment: 'Harassment/Hate',
      inappropriate: 'Inappropriate content',
      other: 'Other'
    };
    return labels[reason] || reason;
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="container mx-auto max-w-6xl">
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4">
        <div className="container mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto max-w-6xl p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Content Reports
            </CardTitle>
            <CardDescription>
              Review and manage reported content from users
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-4">
          {reports.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Shield className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No reports</h3>
                  <p className="text-slate-600">All clear! No reports to review.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <h3 className="font-semibold">
                          {report.target_type.charAt(0).toUpperCase() + report.target_type.slice(1)} Report
                        </h3>
                        <Badge variant={getStatusBadgeVariant(report.status)}>
                          {report.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <p>
                          <span className="font-medium">Reason:</span> {getReasonLabel(report.reason)}
                        </p>
                        <p>
                          <span className="font-medium">Reported by:</span> {report.reporter.name}
                        </p>
                        <p>
                          <span className="font-medium">Content owner:</span> {report.target_owner.name}
                        </p>
                        <p>
                          <span className="font-medium">Target ID:</span>{' '}
                          <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">
                            {report.target_id}
                          </code>
                        </p>
                        <p>
                          <span className="font-medium">Reported:</span>{' '}
                          {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {report.details && (
                        <div className="mt-3">
                          <p className="font-medium text-sm mb-1">Additional details:</p>
                          <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                            {report.details}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <Select
                        value={report.status}
                        onValueChange={(value) => handleStatusChange(report.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="reviewed">Reviewed</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  return (
    <ProtectedRoute>
      <AdminReportsContent />
    </ProtectedRoute>
  );
}
