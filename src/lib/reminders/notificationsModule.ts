import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import type * as NotificationsModule from 'expo-notifications';

type Notifications = typeof NotificationsModule;

// Native modules expo-notifications loads on import (from its build/*.native.js and *.android.js files).
const NATIVE_MODULES = [
  'ExpoBackgroundNotificationTasksModule',
  'ExpoBadgeModule',
  'ExpoNotificationCategoriesModule',
  'ExpoNotificationChannelGroupManager',
  'ExpoNotificationChannelManager',
  'ExpoNotificationPermissionsModule',
  'ExpoNotificationPresenter',
  'ExpoNotificationScheduler',
  'ExpoNotificationsEmitter',
  'ExpoNotificationsHandlerModule',
  'ExpoPushTokenManager',
  'NotificationsServerRegistrationModule',
  ...(Platform.OS === 'android' ? ['ExpoTopicSubscriptionModule'] : []),
];

let cached: Notifications | null | undefined;

/**
 * expo-notifications, or null when this app binary lacks one of its native modules (e.g. an Expo Go build without
 * ExpoTopicSubscriptionModule). Checked before requiring: a failed require is reported as a fatal error even inside
 * try/catch, because Metro reports errors thrown while initializing a module.
 */
export function getNotifications(): Notifications | null {
  if (cached === undefined) {
    const missing = NATIVE_MODULES.filter((name) => requireOptionalNativeModule(name) === null);
    if (missing.length > 0) {
      console.warn(`Notifications are unavailable in this app build (missing ${missing.join(', ')})`);
      cached = null;
    } else {
      cached = require('expo-notifications') as Notifications;
    }
  }
  return cached;
}
