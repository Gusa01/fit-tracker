jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

describe('getNotifications', () => {
  afterEach(() => jest.resetModules());

  it('returns null without requiring expo-notifications when a native module is missing', () => {
    jest.doMock('expo', () => ({
      requireOptionalNativeModule: (name: string) => (name === 'ExpoTopicSubscriptionModule' ? null : {}),
    }));
    const factory = jest.fn(() => ({}));
    jest.doMock('expo-notifications', factory);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.isolateModules(() => {
      const { getNotifications } = require('../../../src/lib/reminders/notificationsModule');
      expect(getNotifications()).toBeNull();
      expect(getNotifications()).toBeNull();
    });
    expect(factory).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('ExpoTopicSubscriptionModule');
    warn.mockRestore();
  });

  it('returns the module when every native module is present', () => {
    jest.doMock('expo', () => ({ requireOptionalNativeModule: () => ({}) }));
    jest.doMock('expo-notifications', () => ({ scheduleNotificationAsync: jest.fn() }));
    jest.isolateModules(() => {
      const { getNotifications } = require('../../../src/lib/reminders/notificationsModule');
      expect(getNotifications()).toHaveProperty('scheduleNotificationAsync');
    });
  });
});
