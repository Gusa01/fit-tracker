import * as Haptics from 'expo-haptics';

// Fire-and-forget: a device without a vibration motor (or a missing native module) must never break a gesture.
export function hapticLift(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

export function hapticTick(): void {
  Haptics.selectionAsync().catch(() => {});
}

export function hapticDrop(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
