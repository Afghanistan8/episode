import type { Metadata } from "next";

import { Shell } from "@/components/Shell";

import "./globals.css";

export const metadata: Metadata = {
  title: "Episode — findings on events that have to be seen",
  description:
    "Did it happen? The file decides, and no single party reads it. Episode " +
    "settles property, vehicle, cargo and visible-interruption events on " +
    "photographs a panel of validators actually saw.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
