import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "7of1",
  description: "7 days, always with you.",
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
