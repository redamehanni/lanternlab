import { ConsumerHeader, ConsumerTabBar } from "@/components/layout/ConsumerHeader";

export default function ConsumerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-secondary">
      <ConsumerHeader />
      <div className="flex-1">{children}</div>
      <ConsumerTabBar />
    </div>
  );
}
