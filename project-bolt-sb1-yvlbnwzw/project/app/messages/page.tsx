'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/contexts/auth-context';
import { usePageTracking } from '@/lib/hooks/use-page-tracking';
import { ProtectedRoute } from '@/components/protected-route';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, ArrowLeft, Briefcase, Trash2, ChevronRight } from 'lucide-react';
import { usePresence } from '@/lib/hooks/use-presence';
import { isOnline } from '@/lib/online-status';

export const revalidate = 0;

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/lib/hooks/use-toast';
import { useLanguage } from '@/lib/contexts/language-context';

type Thread = {
  id: string;
  created_at: string;
  post_id: string | null;
  title: string;
  other_person: {
    name: string;
    avatar_url?: string;
    last_seen?: string;
  } | null;
  unread_count: number;
  last_message?: string;
};

function MessagesListContent() {
  const router = useRouter();
  const { user, profile } = useAuth();
  usePageTracking('messages');
  const { toast } = useToast();
  const { t } = useLanguage();
  usePresence(user?.id);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedFetchThreads = () => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => fetchThreads(), 400);
  };

  useEffect(() => {
    if (user) {
      fetchThreads();

      const messagesChannel = supabase
        .channel(`messages-list:${user.id}`)
        // New message received by current user → update last_message + unread count
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        }, debouncedFetchThreads)
        // Thread participant row changed for current user → new thread or thread deleted
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'thread_participants',
          filter: `user_id=eq.${user.id}`,
        }, debouncedFetchThreads)
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
        if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      };
    }
  }, [user]);

  const fetchThreads = async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any).rpc('get_thread_list');

      if (error) {
        console.error('fetchThreads error:', error);
        setLoading(false);
        return;
      }

      const rows = (data as any[]) ?? [];

      const threads: Thread[] = rows.map((row: any) => ({
        id: row.thread_id,
        created_at: row.last_message_at || '',
        post_id: null,
        title: 'Conversation',
        other_person: row.other_name
          ? {
              name: row.other_name,
              avatar_url: row.other_avatar ?? undefined,
              last_seen: row.other_last_seen ?? undefined,
            }
          : null,
        unread_count: Number(row.unread_count) || 0,
        last_message: row.last_message || '',
      }));

      setThreads(threads);
    } catch (err) {
      console.error('fetchThreads exception:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setThreadToDelete(threadId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!threadToDelete || !user) return;

    const now = new Date().toISOString();
    await supabase
      .from('thread_participants')
      .update({ deleted_at: now, hidden_before: now })
      .eq('thread_id', threadToDelete)
      .eq('user_id', user.id);

    fetchThreads();
    setDeleteDialogOpen(false);
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      
      {/* HEADER */}
      <div className="border-b bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div>
            <h1 className="text-2xl font-bold">{t('messages.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('messages.yourConversations')}
            </p>
          </div>
        </div>
      </div>

      {/* LIST */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-3">
        {loading ? (
          [1,2,3].map(i => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))
        ) : threads.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="mx-auto mb-4 h-10 w-10 text-gray-400" />
            <p>No messages yet</p>
          </div>
        ) : (
          threads.map(thread => {
            const name = thread.other_person?.name || 'Nepoznato ime';
            const hasUnread = thread.unread_count > 0;

            return (
              <Card
                key={thread.id}
                onClick={() => router.push(`/messages/${thread.id}`)}
                className={`cursor-pointer rounded-2xl transition-all
                ${hasUnread ? 'bg-white dark:bg-gray-900 shadow-md border-orange-200 dark:border-orange-900' : 'bg-white dark:bg-gray-900'}
                hover:scale-[1.01] hover:shadow-lg`}
              >
                <CardContent className="p-4 flex items-center gap-4">

                  <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={thread.other_person?.avatar_url} alt={name} />
                      <AvatarFallback className="bg-orange-500 text-white">
                        {name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline(thread.other_person?.last_seen) && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-green-500 dark:border-gray-900" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <h3 className={`truncate ${hasUnread ? 'font-bold' : ''}`}>
                        {name}
                      </h3>

                      {hasUnread && (
                        <Badge className="bg-orange-500 text-white">
                          {thread.unread_count}
                        </Badge>
                      )}
                    </div>

                    {/* 🔥 PREVIEW */}
                    <p className="text-sm text-gray-500 truncate">
                      {thread.last_message || 'Start conversation...'}
                    </p>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => handleDeleteClick(thread.id, e)}
                  >
                    <Trash2 className="h-4 w-4 text-gray-400" />
                  </Button>

                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* DELETE */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('messages.deleteDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{t('messages.deleteCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {t('messages.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

export default function MessagesPage() {
  return (
    <ProtectedRoute>
      <MessagesListContent />
    </ProtectedRoute>
  );
}
