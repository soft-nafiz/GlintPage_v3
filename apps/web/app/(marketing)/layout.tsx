import Footer from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { AccountProvider } from "@/components/account-provider";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountProvider>
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </AccountProvider>
  );
}
