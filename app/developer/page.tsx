import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import DeveloperLogoutButton from "../components/DeveloperLogoutButton";
import HomeIconLink from "../components/HomeIconLink";

const DEVELOPER_COOKIE_NAME = "developer_access";

const featureCardStyle: CSSProperties = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  backgroundColor: "rgba(9, 15, 25, 0.88)",
  boxShadow: "0 12px 32px rgba(2, 6, 23, 0.18)",
};

const featureLinkStyle: CSSProperties = {
  display: "inline-block",
  padding: "10px 16px",
  backgroundColor: "#0f172a",
  color: "white",
  textDecoration: "none",
  borderRadius: 10,
  border: "1px solid rgba(96, 165, 250, 0.18)",
};

type FeatureCard = {
  title: string;
  description: string;
  href: string;
  cta: string;
  prefetch?: boolean;
};

const activeTools: FeatureCard[] = [
  {
    title: "Bug Reports",
    description: "Review bug reports submitted from the live report-bug page.",
    href: "/developer/bugs",
    cta: "Open Bug Reports",
  },
  {
    title: "Suggestions",
    description: "Review submitted suggestions and feedback from the live suggestions page.",
    href: "/developer/suggestions",
    cta: "Open Suggestions",
  },
  {
    title: "Dev Inbox",
    description: "Open the developer inbox tools to send updates, then review and manage sent posts from there.",
    href: "/developer/inbox",
    cta: "Open Dev Inbox",
  },
  {
    title: "Update History",
    description: "Read the full plain-language release log from the start of the project up to the newest shipped build.",
    href: "/developer/updates",
    cta: "Open Update History",
  },
];

const onHoldFeatures: FeatureCard[] = [
  {
    title: "Initial Loader Test",
    description: "Replay the app's full loading screen, then jump straight back here when it finishes.",
    href: "/developer/loading-test",
    cta: "Run Loader Test",
  },
  {
    title: "Messages",
    description: "Open the direct-message feature from here too while we keep building on top of it.",
    href: "/messages/direct",
    cta: "Open Messages",
    prefetch: false,
  },
  {
    title: "Marketplace",
    description: "Open the Marketplace feature from here for quick testing and iteration.",
    href: "/marketplace",
    cta: "Open Marketplace",
    prefetch: false,
  },
  {
    title: "ISO",
    description: "Open the ISO board from here for quick testing and iteration.",
    href: "/iso",
    cta: "Open ISO",
    prefetch: false,
  },
  {
    title: "Events",
    description: "Open the Events feature from here while it stays behind developer access.",
    href: "/events",
    cta: "Open Events",
    prefetch: false,
  },
  {
    title: "Forums",
    description: "Open the Forums feature from here while it stays behind developer access.",
    href: "/q-and-a",
    cta: "Open Forums",
    prefetch: false,
  },
  {
    title: "Global Chat",
    description: "Open the live chat page while we keep refining the feature.",
    href: "/chat",
    cta: "Open Chat",
  },
  {
    title: "Admin Dashboard",
    description: "Open the admin tools from here while the app sections stay behind developer access.",
    href: "/admin",
    cta: "Open Admin",
    prefetch: false,
  },
];

function FeatureSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: FeatureCard[];
}) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ marginBottom: 8 }}>{title}</h2>
      <p style={{ maxWidth: 760, marginTop: 0, color: "#94a3b8" }}>{description}</p>
      <div
        style={{
          marginTop: 18,
          display: "grid",
          gap: 18,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        {items.map((item) => (
          <div key={item.title} style={featureCardStyle}>
            <h3 style={{ marginTop: 0 }}>{item.title}</h3>
            <p style={{ maxWidth: 320 }}>{item.description}</p>
            <Link href={item.href} prefetch={item.prefetch} style={featureLinkStyle}>
              {item.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function DeveloperPage() {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(DEVELOPER_COOKIE_NAME);

  if (accessCookie?.value !== "granted") {
    redirect("/developer/unlock");
  }

  return (
    <main style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <HomeIconLink style={{ marginBottom: 0 }} />
        <DeveloperLogoutButton />
      </div>

      <h1>Developer Tools</h1>
      <p style={{ maxWidth: 720 }}>
        Temporary home for in-progress features so the main screen stays clean while we keep building.
      </p>

      <FeatureSection
        title="Active Tools"
        description="Primary developer workflows and review queues."
        items={activeTools}
      />

      <FeatureSection
        title="On Hold Features"
        description="Feature areas that are still parked here for testing and iteration."
        items={onHoldFeatures}
      />
    </main>
  );
}
