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
        <div className="loading-state-track" />
        <div className="loading-state-b2">
          <svg viewBox="0 0 160 72" fill="none" role="presentation">
            <path
              d="M80 10L128 24L154 36L128 40L102 46L92 56H68L58 46L32 40L6 36L32 24L80 10Z"
              fill="currentColor"
            />
            <path
              d="M80 21L110 29L127 36L108 38L92 41L86 49H74L68 41L52 38L33 36L50 29L80 21Z"
              fill="rgba(255,255,255,0.16)"
            />
          </svg>
        </div>
        <div className="loading-state-target">
          <span />
        </div>
      </div>
      <div>
        <p className="loading-state-title">{title}</p>
        <p className="loading-state-caption">{caption}</p>
      </div>
    </div>
  );
}
