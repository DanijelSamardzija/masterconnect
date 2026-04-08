'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { format } from 'date-fns';

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved';
  admin_notes: string | null;
  created_at: string;
  profiles: {
    name: string;
    email: string;
  };
}

function SupportMessagesContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);

  useEffect(() => {
    if (!profile?.is_admin) {
      router.push('/dashboard');
      return;
    }

    fetchMessages();
  }, [profile, router]);

  const fetchMessages = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Morate biti prijavljeni');
        return;
      }

      const response = await fetch('/api/support', {
        credentials: 'same-origin',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch support messages');
      }

      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching support messages:', error);
      toast.error('Greška pri učitavanju poruka');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Na čekanju</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">U obradi</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Rešeno</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const pendingCount = messages.filter(m => m.status === 'pending').length;
  const inProgressCount = messages.filter(m => m.status === 'in_progress').length;

  if (!profile?.is_admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => router.back()}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Nazad
        </Button>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-6 w-6" />
                  <div>
                    <CardTitle>Poruke podrške</CardTitle>
                    <CardDescription>
                      Pregled svih poruka korisnika
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="text-center px-4 py-2 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-700">{pendingCount}</div>
                    <div className="text-xs text-yellow-600">Na čekanju</div>
                  </div>
                  <div className="text-center px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="text-2xl font-bold text-blue-700">{inProgressCount}</div>
                    <div className="text-xs text-blue-600">U obradi</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Učitavam poruke...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nema poruka za prikaz
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="p-4 border rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedMessage(selectedMessage?.id === message.id ? null : message)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          {getStatusIcon(message.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm">{message.subject}</h4>
                              {getStatusBadge(message.status)}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Od: <span className="font-medium">{message.profiles.name}</span> ({message.profiles.email})
                            </p>
                            {selectedMessage?.id === message.id && (
                              <>
                                <Separator className="my-3" />
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Poruka:</p>
                                    <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                                  </div>
                                  {message.admin_notes && (
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1">Admin beleške:</p>
                                      <p className="text-sm text-muted-foreground">{message.admin_notes}</p>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(message.created_at), 'dd.MM.yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function SupportMessagesPage() {
  return (
    <ProtectedRoute>
      <SupportMessagesContent />
    </ProtectedRoute>
  );
}