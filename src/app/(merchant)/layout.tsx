import { MerchantNav, MerchantMobileBar } from "@/components/layout/MerchantNav";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh bg-surface-secondary">
      <MerchantNav />
      <div className="flex min-h-dvh flex-1 flex-col">
        <div className="flex-1">{children}</div>
        <MerchantMobileBar />
      </div>
    </div>
  );
}
