'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bell, CheckCheck, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useSoundPreference } from '@/hooks/use-sound-preference';

export type Notification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  time: string;
  read: boolean;
  jobId?: string;
  messageId?: string;
  linkUrl?: string;
  meta?: {
    thread_id?: string;
    message_id?: string;
    sender_id?: string;
    post_id?: string;
    comment_id?: string;
    post_text?: string;
    [key: string]: any;
  };
};

interface NotificationsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

export function NotificationsModal({
  open,
  onOpenChange,
  notifications,
  onNotificationClick,
  onMarkAllRead,
  onClearAll
}: NotificationsModalProps) {
  const { soundEnabled, toggleNotificationsSound } = useSoundPreference();

  const getIcon = (type: string) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'comment':
        return '💭';
      case 'reply':
        return '↩️';
      case 'reaction':
        return '❤️';
      case 'save':
        return '🔖';
      case 'follow':
        return '👤';
      case 'job':
        return '🔔';
      case 'completed':
        return '✅';
      case 'review':
        return '⭐';
      case 'credit':
        return '🪙';
      default:
        return '🔔';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleNotificationsSound}
                className="h-8 px-2"
                title={soundEnabled ? 'Mute notifications' : 'Unmute notifications'}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4" />
                )}
              </Button>
              {notifications.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onMarkAllRead}
                    className="h-8 text-xs"
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    Mark all read
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    className="h-8 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Clear all
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col max-h-[60vh] overflow-y-auto">
          {notifications.length > 0 ? (
            notifications.map((notification, index) => (
              <div key={notification.id}>
                <div
                  className={`flex items-start gap-3 py-4 px-2 hover:bg-accent/50 rounded-md transition-colors cursor-pointer ${
                    !notification.read ? 'bg-blue-50 hover:bg-blue-100' : ''
                  }`}
                  onClick={() => onNotificationClick(notification)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onNotificationClick(notification);
                    }
                  }}
                >
                  <span className="text-2xl flex-shrink-0">{getIcon(notification.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight">{notification.title}</p>
                    {notification.body && (
                      <p className="text-xs text-foreground/70 mt-1">{notification.body}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                  </div>
                </div>
                {index < notifications.length - 1 && <Separator />}
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No new notifications yet.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
