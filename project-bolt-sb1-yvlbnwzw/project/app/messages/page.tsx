'use client';

import { useEffect, useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';

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
  usePresence(user?.id);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchThreads();

      const messagesChannel = supabase
        .channel('messages-list-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchThreads)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'thread_participants' }, fetchThreads)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'threads' }, fetchThreads)
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [user]);

  const fetchThreads = async () => {
    if (!user) return;

    try {
      // Step 1: get thread_ids the user participates in (not deleted)
      const { data: participations, error: partError } = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at, deleted_at')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (partError) {
        console.error('fetchThreads error:', partError);
        setLoading(false);
        return;
      }

      if (!participations || participations.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      const threadIds = participations.map((p: any) => p.thread_id);

      // Step 2: for each thread, fetch other participant + last message + unread count
      const threads = await Promise.all(
        participations.map(async (tp: any) => {
          const threadId = tp.thread_id;

          // Other participant profile
          const { data: otherParticipant } = await supabase
            .from('thread_participants')
            .select('user_id, profiles(name, avatar_url, last_seen)')
            .eq('thread_id', threadId)
            .neq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          const otherPerson = otherParticipant?.profiles as any;

          // Last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('text, created_at')
            .eq('thread_id', threadId)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Unread count
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('thread_id', threadId)
            .eq('is_deleted', false)
            .neq('sender_id', user.id)
            .gt('created_at', tp.last_read_at || '1970-01-01');

          return {
            id: threadId,
            created_at: lastMessage?.created_at || tp.last_read_at || '',
            post_id: null,
            title: 'Conversation',
            other_person: otherPerson,
            unread_count: count || 0,
            last_message: lastMessage?.text || '',
          };
        })
      );

      // Sort by most recent message first
      threads.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setThreads(threads as any);
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

    await supabase
      .from('thread_participants')
      .update({ deleted_at: new Date().toISOString() })
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
            <h1 className="text-2xl font-bold">Messages</h1>
            <p className="text-sm text-muted-foreground">
              Your conversations
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
            const name = thread.other_person?.name || 'User';
            const hasUnread = thread.unread_count > 0;

            return (
              <Card
                key={thread.id}
                onClick={() => router.push(`/messages/${thread.id}`)}
                className={`cursor-pointer rounded-2xl transition-all
                ${hasUnread ? 'bg-white shadow-md border-orange-200' : 'bg-white dark:bg-gray-900'}
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
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it only for you.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
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
