export type EventType = "fun" | "sports" | "fitness" | "community_service" | "other";

export type EventScheduleMode = "specific_dates" | "recurring";

export type EventDateEntry = {
  id: string;
  startDate: string;
  endDate?: string | null;
  timeText: string;
};

export type EventRecurringRule = {
  weekday: string;
  startDate: string;
  endDate?: string | null;
  timeText: string;
};

export type EventDocument = {
  name: string;
  type: EventType;
  location: string;
  description: string;
  photoUrl?: string | null;
  neededPeople?: number | null;
  scheduleMode: EventScheduleMode;
  scheduleEntries: EventDateEntry[];
  recurrence?: EventRecurringRule | null;
  createdByUid?: string | null;
  createdByEmail?: string | null;
  createdAt?: {
    seconds?: number;
    nanoseconds?: number;
  } | Date | null;
};

export type EventRecord = EventDocument & {
  id: string;
};

export const EVENT_TYPE_OPTIONS: Array<{ value: EventType; label: string }> = [
  { value: "fun", label: "Fun" },
  { value: "sports", label: "Sports" },
  { value: "fitness", label: "Fitness" },
  { value: "community_service", label: "Community Service" },
  { value: "other", label: "Other" },
];

export const RECURRING_WEEKDAY_OPTIONS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function asLocalDate(dateText: string) {
  return new Date(`${dateText}T12:00:00`);
}

function formatDateText(dateText: string) {
  if (!dateText) {
    return "Date TBD";
  }

  return asLocalDate(dateText).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeEndDate(endDate?: string | null, fallback?: string) {
  return endDate?.trim() || fallback || "";
}

export function createEmptyEventDateEntry(): EventDateEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startDate: "",
    endDate: "",
    timeText: "",
  };
}

export function formatEventTypeLabel(type: EventType) {
  return EVENT_TYPE_OPTIONS.find((option) => option.value === type)?.label || "Other";
}

export function formatEventDateEntry(entry: EventDateEntry) {
  const start = formatDateText(entry.startDate);
  const end = normalizeEndDate(entry.endDate, entry.startDate);
  const rangeLabel =
    end && end !== entry.startDate ? `${start} - ${formatDateText(end)}` : start;

  return entry.timeText.trim() ? `${rangeLabel} • ${entry.timeText.trim()}` : rangeLabel;
}

export function formatRecurringRule(rule?: EventRecurringRule | null) {
  if (!rule) {
    return "Recurring schedule";
  }

  const recurrenceWindow = rule.endDate?.trim()
    ? `${formatDateText(rule.startDate)} - ${formatDateText(rule.endDate)}`
    : `Starting ${formatDateText(rule.startDate)}`;
  const timeLabel = rule.timeText.trim() ? ` • ${rule.timeText.trim()}` : "";

  return `Every ${rule.weekday}${timeLabel} • ${recurrenceWindow}`;
}

export function formatEventScheduleSummary(event: EventDocument) {
  if (event.scheduleMode === "recurring") {
    return formatRecurringRule(event.recurrence);
  }

  const validEntries = event.scheduleEntries.filter((entry) => entry.startDate.trim());

  if (validEntries.length === 0) {
    return "Schedule pending";
  }

  const firstEntry = formatEventDateEntry(validEntries[0]);
  return validEntries.length === 1 ? firstEntry : `${firstEntry} +${validEntries.length - 1} more`;
}

function getWeekdayIndex(weekday: string) {
  return RECURRING_WEEKDAY_OPTIONS.findIndex((value) => value === weekday);
}

function getNextRecurringDate(rule: EventRecurringRule, referenceDateText: string) {
  const weekdayIndex = getWeekdayIndex(rule.weekday);

  if (weekdayIndex === -1 || !rule.startDate.trim()) {
    return null;
  }

  const recurrenceStart = asLocalDate(rule.startDate);
  const rangeStart = asLocalDate(referenceDateText);
  const searchStart = rangeStart > recurrenceStart ? rangeStart : recurrenceStart;
  const next = new Date(searchStart);
  const dayOffset = (weekdayIndex - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + dayOffset);

  if (rule.endDate?.trim() && next > asLocalDate(rule.endDate)) {
    return null;
  }

  return next;
}

function getDateText(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function getEventNextOccurrenceDateText(event: EventDocument, referenceDateText = getTodayDateText()) {
  if (event.scheduleMode === "recurring") {
    const nextRecurringDate = event.recurrence ? getNextRecurringDate(event.recurrence, referenceDateText) : null;
    return nextRecurringDate ? getDateText(nextRecurringDate) : null;
  }

  const upcomingEntries = event.scheduleEntries
    .filter((entry) => entry.startDate.trim())
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const nextEntry = upcomingEntries.find((entry) => normalizeEndDate(entry.endDate, entry.startDate) >= referenceDateText);
  return nextEntry?.startDate || null;
}

export function getTodayDateText() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isUpcomingEvent(event: EventDocument, referenceDateText = getTodayDateText()) {
  return getEventNextOccurrenceDateText(event, referenceDateText) !== null;
}

export function eventMatchesType(event: EventDocument, selectedType: string) {
  return !selectedType || selectedType === "all" || event.type === selectedType;
}

export function eventMatchesDateRange(event: EventDocument, dateFrom: string, dateTo: string) {
  if (!dateFrom && !dateTo) {
    return true;
  }

  const rangeStart = dateFrom || getTodayDateText();
  const rangeEnd = dateTo || "9999-12-31";

  if (event.scheduleMode === "recurring") {
    if (!event.recurrence) {
      return false;
    }

    const nextRecurringDate = getNextRecurringDate(event.recurrence, rangeStart);
    if (!nextRecurringDate) {
      return false;
    }

    return getDateText(nextRecurringDate) <= rangeEnd;
  }

  return event.scheduleEntries.some((entry) => {
    if (!entry.startDate.trim()) {
      return false;
    }

    const entryEnd = normalizeEndDate(entry.endDate, entry.startDate);
    return entry.startDate <= rangeEnd && entryEnd >= rangeStart;
  });
}

export function getEventCardDateLabel(event: EventDocument) {
  if (event.scheduleMode === "recurring") {
    return formatRecurringRule(event.recurrence);
  }

  const nextDateText = getEventNextOccurrenceDateText(event);

  if (!nextDateText) {
    return "Past event";
  }

  const matchingEntry = event.scheduleEntries.find((entry) => entry.startDate === nextDateText);
  return matchingEntry ? formatEventDateEntry(matchingEntry) : formatDateText(nextDateText);
}

export function sortEventsByUpcomingDate(events: EventRecord[]) {
  const today = getTodayDateText();

  return [...events].sort((a, b) => {
    const nextA = getEventNextOccurrenceDateText(a, today) || "9999-12-31";
    const nextB = getEventNextOccurrenceDateText(b, today) || "9999-12-31";

    if (nextA !== nextB) {
      return nextA.localeCompare(nextB);
    }

    return a.name.localeCompare(b.name);
  });
}
