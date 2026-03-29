"use client";

type QAVoteControlsProps = {
  score: number;
  currentVote: number;
  onVote: (value: 1 | -1) => Promise<void>;
  compact?: boolean;
};

const buttonBaseStyle: React.CSSProperties = {
  minHeight: 26,
  minWidth: 26,
  padding: "0 6px",
  borderRadius: 10,
  border: "1px solid rgba(126, 142, 160, 0.16)",
  background: "rgba(15, 23, 42, 0.74)",
  color: "#dbe7f5",
  fontSize: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export default function QAVoteControls({ score, currentVote, onVote, compact = false }: QAVoteControlsProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 4 : 6,
        padding: compact ? "3px 5px" : "5px 7px",
        borderRadius: 12,
        border: "1px solid rgba(126, 142, 160, 0.16)",
        background: "rgba(17, 24, 39, 0.62)",
      }}
    >
      <button
        type="button"
        onClick={() => void onVote(1)}
        aria-label="Thumbs up"
        style={{
          ...buttonBaseStyle,
          minHeight: compact ? 24 : 26,
          minWidth: compact ? 24 : 26,
          background: currentVote === 1 ? "rgba(22, 163, 74, 0.2)" : buttonBaseStyle.background,
          border: currentVote === 1 ? "1px solid rgba(74, 222, 128, 0.28)" : buttonBaseStyle.border,
          color: currentVote === 1 ? "#bbf7d0" : "#dbe7f5",
        }}
      >
        👍
      </button>
      <span
        style={{
          minWidth: compact ? 18 : 22,
          textAlign: "center",
          color: "#dbe7f5",
          fontSize: compact ? 10 : 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "var(--font-display)",
        }}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => void onVote(-1)}
        aria-label="Thumbs down"
        style={{
          ...buttonBaseStyle,
          minHeight: compact ? 24 : 26,
          minWidth: compact ? 24 : 26,
          background: currentVote === -1 ? "rgba(185, 28, 28, 0.2)" : buttonBaseStyle.background,
          border: currentVote === -1 ? "1px solid rgba(248, 113, 113, 0.28)" : buttonBaseStyle.border,
          color: currentVote === -1 ? "#fecaca" : "#dbe7f5",
        }}
      >
        👎
      </button>
    </div>
  );
}
