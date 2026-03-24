import DeveloperBackLink from "../../components/DeveloperBackLink";
import MissionLoadingScreen from "../../loading";

export default function FullLoadingPreviewPage() {
  return (
    <div>
      <main style={{ padding: 20 }}>
        <DeveloperBackLink />
      </main>
      <MissionLoadingScreen />
    </div>
  );
}
