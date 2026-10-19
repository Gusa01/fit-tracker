import type * as NotificationsModule from 'expo-notifications';

type Notifications = typeof NotificationsModule;

let cached: Notifications | null | undefined;

/**
 * expo-notifications, or null when this app binary lacks its native modules (e.g. an Expo Go build without
 * ExpoTopicSubscriptionModule). Loaded lazily: a static import throws while the bundle loads and crashes the app.
 */
export function getNotifications(): Notifications | null {
  if (cached === undefined) {
    try {
      cached = require('expo-notifications') as Notifications;
    } catch (err) {
      console.warn('Notifications are unavailable in this app build', err);
      cached = null;
    }
  }
  return cached;
}
