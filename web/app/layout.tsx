import type { Metadata } from "next";

import { Shell } from "@/components/Shell";
import { WalletSession } from "@/lib/wallet";

import "./globals.css";

export const metadata: Metadata = {
  title: "Episode. A receipt for a loss you can see.",
  description:
    "Sponsors lock a programme. Claimants file the scene. Validators rate " +
    "what is in the frames. One rule seals the finding.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletSession><Shell>{children}</Shell></WalletSession>
      </body>
    </html>
  );
}
