describe('getNotifications', () => {
  afterEach(() => jest.resetModules());

  it('returns null instead of crashing when the native module is missing', () => {
    jest.doMock('expo-notifications', () => {
      throw new Error("Cannot find native module 'ExpoTopicSubscriptionModule'");
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.isolateModules(() => {
      const { getNotifications } = require('../../../src/lib/reminders/notificationsModule');
      expect(getNotifications()).toBeNull();
      expect(getNotifications()).toBeNull();
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns the module when it loads', () => {
    jest.doMock('expo-notifications', () => ({ scheduleNotificationAsync: jest.fn() }));
    jest.isolateModules(() => {
      const { getNotifications } = require('../../../src/lib/reminders/notificationsModule');
      expect(getNotifications()).toHaveProperty('scheduleNotificationAsync');
    });
  });
});
