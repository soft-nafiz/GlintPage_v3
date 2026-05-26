import { Navbar } from "@/components/Navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}
