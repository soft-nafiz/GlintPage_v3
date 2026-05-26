export default function ReaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-full h-screen overflow-hidden">{children}</div>;
}
