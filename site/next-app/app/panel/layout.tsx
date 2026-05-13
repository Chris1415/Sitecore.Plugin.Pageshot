import { MarketplaceProvider } from "@/components/providers/marketplace";

export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <MarketplaceProvider>{children}</MarketplaceProvider>;
}
