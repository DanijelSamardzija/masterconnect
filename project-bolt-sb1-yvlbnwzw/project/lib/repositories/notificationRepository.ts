import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type NotificationInsert = Database['public']['Tables']['notifications']['Insert'];

export const notificationRepository = {
  async getAll(userId: string): Promise<NotificationRow[]> {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data ?? [];
  },

  async getUnreadCount(userId: string): Promise<number> {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    return count ?? 0;
  },

  async existsByType(userId: string, type: string): Promise<boolean> {
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .limit(1);
    return (data?.length ?? 0) > 0;
  },

  async existsByActionType(userId: string, actionType: string): Promise<boolean> {
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('action_type', actionType)
      .limit(1);
    return (data?.length ?? 0) > 0;
  },

  async insert(notification: NotificationInsert): Promise<void> {
    await supabase.from('notifications').insert(notification);
  },

  async insertMany(notifications: NotificationInsert[]): Promise<void> {
    await supabase.from('notifications').insert(notifications);
  },

  async markRead(id: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  },

  async markAllRead(userId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
  },

  async markThreadRead(userId: string, threadId: string): Promise<void> {
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('type', 'message')
      .is('read_at', null)
      .contains('meta', { thread_id: threadId });
  },

  async deleteAll(userId: string): Promise<void> {
    await supabase.from('notifications').delete().eq('user_id', userId);
  },

  createChannel(userId: string, onInsert: (notification: NotificationRow) => void) {
    return supabase
      .channel(`notifications:${userId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => onInsert(payload.new as NotificationRow)
      );
  },
};
