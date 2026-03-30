"use client";

import { useState } from "react";

type ContextMessageButtonProps = {
  label: string;
  openingLabel?: string;
  onOpen: () => Promise<void>;
  onError?: (message: string) => void;
  style?: React.CSSProperties;
};

const defaultButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "8px 13px",
  borderRadius: 10,
  border: "1px solid rgba(126, 142, 160, 0.24)",
  background: "linear-gradient(180deg, rgba(71, 104, 145, 0.96) 0%, rgba(34, 54, 84, 0.98) 100%)",
  color: "#ffffff",
  fontFamily: "var(--font-display)",
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  fontSize: 10.5,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 28px rgba(17, 24, 39, 0.26)",
};

export default function ContextMessageButton({
  label,
  openingLabel = "Opening...",
  onOpen,
  onError,
  style,
}: ContextMessageButtonProps) {
  const [opening, setOpening] = useState(false);

  return (
    <button
      type="button"
      disabled={opening}
      onClick={async () => {
        try {
          setOpening(true);
          onError?.("");
          await onOpen();
        } catch (error) {
          onError?.(error instanceof Error ? error.message : "Could not open the message thread.");
        } finally {
          setOpening(false);
        }
      }}
      style={{
        ...defaultButtonStyle,
        ...(opening ? { opacity: 0.75, cursor: "wait" } : {}),
        ...style,
      }}
    >
      {opening ? openingLabel : label}
    </button>
  );
}
