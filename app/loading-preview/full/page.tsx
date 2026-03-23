import HomeIconLink from "../../components/HomeIconLink";
import MissionLoadingScreen from "../../loading";

export default function FullLoadingPreviewPage() {
  return (
    <div>
      <main style={{ padding: 20 }}>
        <HomeIconLink />
      </main>
      <MissionLoadingScreen />
    </div>
  );
}
