import AppLoadingState from "../../components/AppLoadingState";
import DeveloperBackLink from "../../components/DeveloperBackLink";

export default function InlineLoadingPreviewPage() {
  return (
    <main style={{ padding: 20 }}>
      <DeveloperBackLink />
      <h1>Inline Loading Preview</h1>
      <p style={{ maxWidth: 640 }}>
        This page holds the smaller in-page loader so you can watch it without the app navigating away.
      </p>

      <div style={{ marginTop: 20, display: "grid", gap: 18, maxWidth: 720 }}>
        <AppLoadingState
          delayMs={0}
          title="Loading Ride Status"
          caption="Tracking your driver, route, and ride timeline."
        />
        <AppLoadingState
          compact
          delayMs={0}
          title="Checking Active Rides"
          caption="Scanning your rider and driver status now."
        />
      </div>
    </main>
  );
}
