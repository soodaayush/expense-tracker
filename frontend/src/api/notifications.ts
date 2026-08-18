import { NotificationPreferences, NotificationPreferencesPatch } from "../types/notificationPreferences";
import { apiFetch } from "./client";

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const data = await apiFetch<{ preferences: NotificationPreferences }>("/notifications/preferences");
  return data.preferences;
}

export async function updateNotificationPreferences(
  patch: NotificationPreferencesPatch
): Promise<NotificationPreferences> {
  const data = await apiFetch<{ preferences: NotificationPreferences }>("/notifications/preferences", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return data.preferences;
}
