export interface NotificationPreferences {
  email: string | null;
  enabled: boolean;
  leadDays: number;
  sendHour: number;
  sendMinute: number;
  timeZone: string;
}

export type NotificationPreferencesPatch = Partial<NotificationPreferences>;
