import { useState, useEffect } from 'react';

const NOTIFICATIONS_SOUND_KEY = 'notificationsSoundEnabled';
const MESSAGES_SOUND_KEY = 'messagesSoundEnabled';

export function useSoundPreference() {
  const [notificationsSoundEnabled, setNotificationsSoundEnabled] = useState(true);
  const [messagesSoundEnabled, setMessagesSoundEnabled] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoaded(true);
      return;
    }

    try {
      const storedNotifications = localStorage.getItem(NOTIFICATIONS_SOUND_KEY);
      const storedMessages = localStorage.getItem(MESSAGES_SOUND_KEY);

      if (storedNotifications !== null) {
        setNotificationsSoundEnabled(storedNotifications === 'true');
      }
      if (storedMessages !== null) {
        setMessagesSoundEnabled(storedMessages === 'true');
      }
    } catch (error) {
      console.warn('[useSoundPreference] localStorage access blocked:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const toggleNotificationsSound = () => {
    const newValue = !notificationsSoundEnabled;
    setNotificationsSoundEnabled(newValue);
    try {
      localStorage.setItem(NOTIFICATIONS_SOUND_KEY, String(newValue));
    } catch (error) {
      console.warn('[useSoundPreference] localStorage write blocked:', error);
    }
  };

  const toggleMessagesSound = () => {
    const newValue = !messagesSoundEnabled;
    setMessagesSoundEnabled(newValue);
    try {
      localStorage.setItem(MESSAGES_SOUND_KEY, String(newValue));
    } catch (error) {
      console.warn('[useSoundPreference] localStorage write blocked:', error);
    }
  };

  return {
    notificationsSoundEnabled,
    messagesSoundEnabled,
    toggleNotificationsSound,
    toggleMessagesSound,
    isLoaded,
    soundEnabled: notificationsSoundEnabled
  };
}
