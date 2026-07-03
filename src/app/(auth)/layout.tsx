export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-secondary px-5 py-10">
      {children}
    </div>
  );
}
