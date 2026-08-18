import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotificationPreferences, updateNotificationPreferences } from "../api/notifications";
import { NotificationPreferencesPatch } from "../types/notificationPreferences";

export const NOTIFICATION_PREFERENCES_KEY = ["notificationPreferences"];

export function useNotificationPreferencesQuery() {
  return useQuery({ queryKey: NOTIFICATION_PREFERENCES_KEY, queryFn: fetchNotificationPreferences });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: NotificationPreferencesPatch) => updateNotificationPreferences(patch),
    onSuccess: (preferences) => {
      queryClient.setQueryData(NOTIFICATION_PREFERENCES_KEY, preferences);
    },
  });
}
