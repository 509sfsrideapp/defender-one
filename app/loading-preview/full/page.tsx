import DeveloperBackLink from "../../components/DeveloperBackLink";
import DelayedRouteLoading from "../../components/DelayedRouteLoading";

export default function FullLoadingPreviewPage() {
  return (
    <div>
      <main style={{ padding: 20 }}>
        <DeveloperBackLink />
      </main>
      <DelayedRouteLoading delayMs={0} />
    </div>
  );
}
