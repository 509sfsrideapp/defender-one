import { isAdminEmail } from "../admin";
import { hasRequiredAccountInfo, canDrive } from "../profile-readiness";
import { normalizeOfficeValue } from "../offices";
import {
  createFirestoreDocument,
  getFirestoreDocument,
  listFirestoreDocuments,
  patchFirestoreDocument,
} from "./firestore-admin";
import { sendPushMessage } from "./fcm";

type DriverCoverageUser = {
  id: string;
  available?: boolean | null;
  name?: string | null;
  email?: string | null;
  flight?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rank?: string | null;
  phone?: string | null;
  riderPhotoUrl?: string | null;
  driverPhotoUrl?: string | null;
  carYear?: string | null;
  carMake?: string | null;
  carModel?: string | null;
  carColor?: string | null;
  notificationsEnabled?: boolean | null;
  notificationTokens?: string[] | null;
  notificationTokenMap?: Record<string, string> | null;
};

type DriverCoverageAlertState = {
  lastSquadronLowCoverageSentAt?: string | null;
  lastSquadronZeroCoverageSentAt?: string | null;
  officeZeroCoverageSentAt?: Record<string, string> | null;
};

type DriverCoverageTarget = {
  id: string;
  name: string;
  email: string;
  office: string;
  tokens: string[];
};

type CoverageRunOptions = {
  origin?: string;
  now?: Date;
};

const STATE_DOCUMENT_PATH = "appRuntimeConfig/driverCoverageAlerts";
const ONE_HOUR_MS = 60 * 60 * 1000;

function extractNotificationTokens(user: DriverCoverageUser) {
  const mappedTokens = Object.values(user.notificationTokenMap || {}).filter(Boolean);
  const arrayTokens = (user.notificationTokens || []).filter(Boolean);
  return Array.from(new Set([...mappedTokens, ...arrayTokens]));
}

function buildCoverageName(user: DriverCoverageUser) {
  return (
    user.name?.trim() ||
    [user.rank?.trim(), user.lastName?.trim()].filter(Boolean).join(" ").trim() ||
    user.email?.split("@")[0] ||
    "Driver"
  );
}

function isValidNotifiableDriver(user: DriverCoverageUser) {
  return (
    !isAdminEmail(user.email) &&
    hasRequiredAccountInfo(user) &&
    canDrive(user)
  );
}

function shouldSendHourly(lastSentAt: string | null | undefined, now: Date) {
  if (!lastSentAt) {
    return true;
  }

  const lastSentMs = new Date(lastSentAt).getTime();
  if (!Number.isFinite(lastSentMs)) {
    return true;
  }

  return now.getTime() - lastSentMs >= ONE_HOUR_MS;
}

async function saveAlertState(nextState: DriverCoverageAlertState, existing: DriverCoverageAlertState | null) {
  if (existing) {
    await patchFirestoreDocument(STATE_DOCUMENT_PATH, {
      lastSquadronLowCoverageSentAt: nextState.lastSquadronLowCoverageSentAt || null,
      lastSquadronZeroCoverageSentAt: nextState.lastSquadronZeroCoverageSentAt || null,
      officeZeroCoverageSentAt: nextState.officeZeroCoverageSentAt || {},
      updatedAt: new Date(),
    });
    return;
  }

  await createFirestoreDocument(
    "appRuntimeConfig",
    {
      lastSquadronLowCoverageSentAt: nextState.lastSquadronLowCoverageSentAt || null,
      lastSquadronZeroCoverageSentAt: nextState.lastSquadronZeroCoverageSentAt || null,
      officeZeroCoverageSentAt: nextState.officeZeroCoverageSentAt || {},
      updatedAt: new Date(),
    },
    "driverCoverageAlerts"
  );
}

async function sendCoveragePush(input: {
  targets: DriverCoverageTarget[];
  title: string;
  body: string;
  origin?: string;
}) {
  const tokens = input.targets.flatMap((target) => target.tokens);

  if (tokens.length === 0) {
    return 0;
  }

  await sendPushMessage({
    tokens,
    title: input.title,
    body: input.body,
    link: "/driver",
    origin: input.origin,
  });

  return input.targets.length;
}

export async function runDriverCoverageAlertMonitor(options: CoverageRunOptions = {}) {
  const now = options.now || new Date();
  const users = (await listFirestoreDocuments("users")) as DriverCoverageUser[];
  const state = await getFirestoreDocument<DriverCoverageAlertState>(STATE_DOCUMENT_PATH);

  const validDrivers = users.filter(isValidNotifiableDriver);
  const availableDrivers = validDrivers.filter((user) => user.available === true);
  const offDutyDrivers: DriverCoverageTarget[] = validDrivers
    .filter((user) => user.available !== true && user.notificationsEnabled !== false)
    .map((user) => ({
      id: user.id,
      name: buildCoverageName(user),
      email: user.email?.trim() || "",
      office: normalizeOfficeValue(user.flight),
      tokens: extractNotificationTokens(user),
    }))
    .filter((user) => user.tokens.length > 0);

  const availableOffices = new Set<string>(
    availableDrivers
      .map((user) => normalizeOfficeValue(user.flight))
      .filter(Boolean)
  );

  const nextState: DriverCoverageAlertState = {
    lastSquadronLowCoverageSentAt: state?.lastSquadronLowCoverageSentAt || null,
    lastSquadronZeroCoverageSentAt: state?.lastSquadronZeroCoverageSentAt || null,
    officeZeroCoverageSentAt: { ...(state?.officeZeroCoverageSentAt || {}) },
  };

  const sentAlerts: Array<{ kind: string; targetCount: number }> = [];
  const availableDriverCount = availableDrivers.length;

  if (availableDriverCount < 5) {
    if (shouldSendHourly(nextState.lastSquadronLowCoverageSentAt, now)) {
      const targetCount = await sendCoveragePush({
        targets: offDutyDrivers,
        title: "Driver Coverage Low",
        body: "There are fewer than 5 available drivers for the squadron right now.",
        origin: options.origin,
      });

      nextState.lastSquadronLowCoverageSentAt = now.toISOString();
      sentAlerts.push({ kind: "squadron_low", targetCount });
    }
  } else {
    nextState.lastSquadronLowCoverageSentAt = null;
  }

  if (availableDriverCount === 0) {
    if (shouldSendHourly(nextState.lastSquadronZeroCoverageSentAt, now)) {
      const targetCount = await sendCoveragePush({
        targets: offDutyDrivers,
        title: "No Drivers Available",
        body: "There are currently 0 available drivers clocked in for the squadron.",
        origin: options.origin,
      });

      nextState.lastSquadronZeroCoverageSentAt = now.toISOString();
      sentAlerts.push({ kind: "squadron_zero", targetCount });
    }
  } else {
    nextState.lastSquadronZeroCoverageSentAt = null;
  }

  const officeTargets = new Map<string, DriverCoverageTarget[]>();
  for (const target of offDutyDrivers) {
    if (!target.office) {
      continue;
    }
    const currentTargets = officeTargets.get(target.office) || [];
    currentTargets.push(target);
    officeTargets.set(target.office, currentTargets);
  }

  const officeStateEntries = { ...(nextState.officeZeroCoverageSentAt || {}) };

  for (const [office, targets] of officeTargets.entries()) {
    if (availableOffices.has(office)) {
      delete officeStateEntries[office];
      continue;
    }

    if (!shouldSendHourly(officeStateEntries[office], now)) {
      continue;
    }

    const targetCount = await sendCoveragePush({
      targets,
      title: `${office} Coverage Needed`,
      body: `No one from ${office} is currently clocked in and available to give rides.`,
      origin: options.origin,
    });

    officeStateEntries[office] = now.toISOString();
    sentAlerts.push({ kind: `office_zero:${office}`, targetCount });
  }

  const officeKeys = new Set(officeTargets.keys());
  for (const existingOffice of Object.keys(officeStateEntries)) {
    if (!officeKeys.has(existingOffice)) {
      delete officeStateEntries[existingOffice];
    }
  }

  nextState.officeZeroCoverageSentAt = officeStateEntries;

  await saveAlertState(nextState, state);

  return {
    checkedAt: now.toISOString(),
    validDriverCount: validDrivers.length,
    availableDriverCount,
    offDutyNotifiableDriverCount: offDutyDrivers.length,
    sentAlerts,
  };
}
