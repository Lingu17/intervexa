import type { Metadata } from "next";
import "./globals.css";
import "./premium.css";
export const metadata: Metadata = {
  title: {
    default: "Intervexa — Every interaction. Verified.",
    template: "%s · Intervexa",
  },
  description:
    "Understand your codebase, trace dependencies and verify how pending changes interact with revision-pinned evidence.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
