import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

const appBaseUrl = defineSecret("APP_BASE_URL");
const cronSecret = defineSecret("CRON_SECRET");

export const driverCoverageAlerts = onSchedule(
  {
    schedule: "0 * * * *",
    timeZone: "America/Chicago",
    secrets: [appBaseUrl, cronSecret],
    region: "us-central1",
    retryCount: 0,
  },
  async () => {
    const origin = appBaseUrl.value().replace(/\/+$/, "");
    const secret = cronSecret.value();
    const targetUrl = `${origin}/api/notifications/driver-coverage`;

    logger.info("Running scheduled driver coverage alert check.", {
      targetUrl,
    });

    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      logger.error("Driver coverage alert check failed.", {
        status: response.status,
        body: responseText,
      });
      throw new Error(`Driver coverage alert check failed with status ${response.status}.`);
    }

    logger.info("Driver coverage alert check completed.", {
      body: responseText,
    });
  }
);
