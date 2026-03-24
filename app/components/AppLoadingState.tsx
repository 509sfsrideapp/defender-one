import Image from "next/image";
import afgscLogo from "../afgsc.png";
import targetImage from "../target.png";

type AppLoadingStateProps = {
  title?: string;
  caption?: string;
  compact?: boolean;
};

export default function AppLoadingState({
  title = "Mission Loading",
  caption = "Routing your ride operations through Global Strike Command.",
  compact = false,
}: AppLoadingStateProps) {
  return (
    <div className={`loading-state ${compact ? "loading-state-compact" : ""}`} aria-label={title}>
      <div className="loading-state-visual" aria-hidden="true">
        <div className="loading-state-origin">
          <Image
            src={afgscLogo}
            alt="Air Force Global Strike Command"
            width={36}
            height={36}
            className="loading-state-origin-logo"
          />
        </div>
        <div className="loading-state-track" />
        <div className="loading-state-b2">
          <svg viewBox="0 0 160 72" fill="none" role="presentation" className="loading-b2-shape">
            <path
              d="M80 8L154 38L140 50L113 31L99 42L90 35L80 44L70 35L61 42L47 31L20 50L6 38L80 8Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="loading-state-target">
          <Image
            src={targetImage}
            alt="Target"
            width={28}
            height={28}
            className="loading-state-target-image"
          />
        </div>
      </div>
      <div>
        <p className="loading-state-title">{title}</p>
        <p className="loading-state-caption">{caption}</p>
      </div>
    </div>
  );
}
