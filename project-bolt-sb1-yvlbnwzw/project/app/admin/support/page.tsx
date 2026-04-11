'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Mail, Clock, CheckCircle, AlertCircle, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { format } from 'date-fns';

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'open';
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
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

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
      if (!session) { toast.error('Morate biti prijavljeni'); return; }

      const response = await fetch('/api/support', {
        credentials: 'same-origin',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch support messages');
      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching support messages:', error);
      toast.error('Greška pri učitavanju poruka');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReply = async (message: SupportMessage) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/support/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          messageId: message.id,
          replyText: replyText.trim(),
          toEmail: message.profiles.email,
          toName: message.profiles.name,
          subject: message.subject,
        }),
      });

      if (!response.ok) throw new Error('Failed to send reply');
      toast.success('Odgovor je poslat!');
      setReplyText('');
      fetchMessages();
    } catch (error) {
      toast.error('Greška pri slanju odgovora');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (messageId: string, newStatus: string) => {
    setUpdatingStatus(messageId);
    try {
      const { error } = await supabase
        .from('support_messages')
        .update({ status: newStatus })
        .eq('id', messageId);

      if (error) throw error;
      toast.success('Status ažuriran');
      fetchMessages();
    } catch (error) {
      toast.error('Greška pri ažuriranju statusa');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': case 'open':
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
      case 'pending': case 'open':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'in_progress':
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <Mail className="h-4 w-4" />;
    }
  };

  const pendingCount = messages.filter(m => m.status === 'pending' || m.status === 'open').length;
  const inProgressCount = messages.filter(m => m.status === 'in_progress').length;

  if (!profile?.is_admin) return null;

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        <Button variant="ghost" className="mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Nazad
        </Button>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-6 w-6" />
                  <div>
                    <CardTitle>Poruke podrške</CardTitle>
                    <CardDescription>Pregled i odgovaranje na poruke korisnika</CardDescription>
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
                <div className="text-center py-8 text-muted-foreground">Učitavam poruke...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nema poruka za prikaz</div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="border rounded-lg overflow-hidden">
                      {/* Header — click to expand */}
                      <div
                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedMessage(selectedMessage?.id === message.id ? null : message);
                          setReplyText('');
                        }}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            {getStatusIcon(message.status)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-semibold text-sm">{message.subject}</h4>
                                {getStatusBadge(message.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Od: <span className="font-medium">{message.profiles?.name ?? '—'}</span>
                                {message.profiles?.email && (
                                  <span className="ml-1 text-orange-600">({message.profiles.email})</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(message.created_at), 'dd.MM.yyyy HH:mm')}
                          </p>
                        </div>
                      </div>

                      {/* Expanded */}
                      {selectedMessage?.id === message.id && (
                        <div className="border-t bg-white p-4 space-y-4">
                          {/* Message */}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Poruka:</p>
                            <p className="text-sm whitespace-pre-wrap bg-slate-50 rounded p-3">{message.message}</p>
                          </div>

                          {/* Status change */}
                          <div className="flex items-center gap-3">
                            <p className="text-xs font-medium text-muted-foreground">Status:</p>
                            <Select
                              value={message.status}
                              onValueChange={(val) => handleStatusChange(message.id, val)}
                              disabled={updatingStatus === message.id}
                            >
                              <SelectTrigger className="w-40 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Na čekanju</SelectItem>
                                <SelectItem value="in_progress">U obradi</SelectItem>
                                <SelectItem value="resolved">Rešeno</SelectItem>
                              </SelectContent>
                            </Select>
                            {updatingStatus === message.id && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>

                          <Separator />

                          {/* Reply */}
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Odgovori na: <span className="text-orange-600">{message.profiles?.email}</span>
                            </p>
                            <Textarea
                              placeholder="Napišite odgovor..."
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              rows={4}
                            />
                            <Button
                              onClick={() => handleReply(message)}
                              disabled={sending || !replyText.trim()}
                              className="bg-orange-500 hover:bg-orange-600 text-white"
                            >
                              {sending ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Šaljem...</>
                              ) : (
                                <><Send className="mr-2 h-4 w-4" /> Pošalji odgovor</>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
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
