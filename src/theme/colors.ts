export interface ColorTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  onAccent: string;
  accentMuted: string;
  success: string;
  successMuted: string;
  danger: string;
  dangerMuted: string;
  warning: string;
  warningMuted: string;
  overlay: string;
}

export const lightColors: ColorTokens = {
  background: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F5',
  border: '#DDE2E8',
  text: '#111827',
  textMuted: '#6B7280',
  accent: '#2563EB',
  onAccent: '#FFFFFF',
  accentMuted: '#DBEAFE',
  success: '#12883E',
  successMuted: '#F0FDF4',
  danger: '#DC2626',
  dangerMuted: '#FEF2F2',
  warning: '#AF6005',
  warningMuted: '#FFFBEB',
  overlay: 'rgba(0,0,0,0.3)',
};

export const darkColors: ColorTokens = {
  background: '#0B0F14',
  surface: '#151A21',
  surfaceMuted: '#1E252E',
  border: '#2A323D',
  text: '#F3F4F6',
  textMuted: '#9CA3AF',
  accent: '#3473DA',
  onAccent: '#FFFFFF',
  accentMuted: '#1E3A5F',
  success: '#22C55E',
  successMuted: '#052E1A',
  danger: '#F87171',
  dangerMuted: '#3B1414',
  warning: '#F59E0B',
  warningMuted: '#2D2006',
  overlay: 'rgba(0,0,0,0.6)',
};
