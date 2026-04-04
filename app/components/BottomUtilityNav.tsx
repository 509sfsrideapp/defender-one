import type { CSSProperties } from "react";
import Link from "next/link";
import { ReportMisconductButton } from "./MisconductReporting";

const linkStyle: CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  color: "#8ea0b3",
  fontSize: 12,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function BottomUtilityNav() {
  return (
    <nav
      aria-label="Feedback links"
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 18,
        padding: "4px 16px 0",
        flexWrap: "wrap",
      }}
    >
      <ReportMisconductButton />
      <Link href="/report-bug" style={linkStyle}>Report Bug</Link>
      <Link href="/developer" style={linkStyle}>Dev</Link>
      <Link href="/suggestions" style={linkStyle}>Suggestions</Link>
    </nav>
  );
}
