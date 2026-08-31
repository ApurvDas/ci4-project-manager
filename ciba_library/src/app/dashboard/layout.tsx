import { DashboardNav } from "@/components/dashboard/DashboardNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <DashboardNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
