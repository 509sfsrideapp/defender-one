export type UserNotificationPreferences = {
  forums: boolean;
  inboxMessages: boolean;
  directMessages: boolean;
  eventCreations: boolean;
  eventRsvps: boolean;
};

export const DEFAULT_USER_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  forums: true,
  inboxMessages: true,
  directMessages: true,
  eventCreations: true,
  eventRsvps: true,
};

export const USER_NOTIFICATION_PREFERENCE_OPTIONS: Array<{
  key: keyof UserNotificationPreferences;
  title: string;
  description: string;
}> = [
  {
    key: "forums",
    title: "Forum Responses",
    description: "Notify me when someone comments on my forum post or replies to one of my comments.",
  },
  {
    key: "inboxMessages",
    title: "Inbox Messages",
    description: "Notify me when a new Notifications, Admin, or Dev inbox message is sent to me.",
  },
  {
    key: "directMessages",
    title: "Messages, Marketplace, ISO, and Events",
    description: "Notify me when someone sends a new direct, Marketplace, ISO, or event-related message.",
  },
  {
    key: "eventCreations",
    title: "New Event Creations",
    description: "Notify me when a new event is posted.",
  },
  {
    key: "eventRsvps",
    title: "Event RSVPs",
    description: "Notify me when someone joins an event that I created.",
  },
];

export function normalizeUserNotificationPreferences(
  value?: Partial<UserNotificationPreferences> | null
) {
  return {
    forums: value?.forums !== false,
    inboxMessages: value?.inboxMessages !== false,
    directMessages: value?.directMessages !== false,
    eventCreations: value?.eventCreations !== false,
    eventRsvps: value?.eventRsvps !== false,
  } satisfies UserNotificationPreferences;
}
