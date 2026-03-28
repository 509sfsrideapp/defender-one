export default function EventsPage() {
  return (
    <main style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <section
        style={{
          borderRadius: 18,
          border: "1px solid rgba(126, 142, 160, 0.18)",
          background: "linear-gradient(180deg, rgba(18, 23, 29, 0.96) 0%, rgba(9, 12, 17, 0.985) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 44px rgba(0, 0, 0, 0.3)",
          padding: "1.25rem 1.2rem 1.35rem",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <p
            style={{
              margin: 0,
              color: "#94a3b8",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontFamily: "var(--font-display)",
            }}
          >
            Scheduling and group coordination
          </p>
          <h1 style={{ margin: 0 }}>Events</h1>
          <p style={{ margin: 0, maxWidth: 640, color: "#cbd5e1" }}>
            This is the placeholder screen for the Events app. We can wire in calendars, squadron event cards,
            RSVP tracking, and attendance details here next.
          </p>
        </div>

        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(126, 142, 160, 0.16)",
            background: "linear-gradient(180deg, rgba(13, 18, 24, 0.96) 0%, rgba(7, 10, 14, 0.98) 100%)",
            padding: "1rem 1rem 1.05rem",
            display: "grid",
            gap: 10,
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#dbe5f2",
              fontFamily: "var(--font-display)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontSize: 12,
            }}
          >
            Placeholder Status
          </p>
          <p style={{ margin: 0, color: "#94a3b8" }}>
            Route is live and ready for the first real events feature pass.
          </p>
        </div>
      </section>
    </main>
  );
}
