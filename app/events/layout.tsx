import type { ReactNode } from "react";
import { requireDeveloperAccess } from "../../lib/server/developer-access";

export default async function EventsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireDeveloperAccess();
  return children;
}
