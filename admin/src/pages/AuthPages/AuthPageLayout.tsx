import React from "react";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen bg-white dark:bg-gray-900">
      <div className="flex min-h-screen w-full items-center justify-center p-6">
        {children}
      </div>
      <div className="fixed right-6 bottom-6 z-50 hidden sm:block">
        <ThemeTogglerTwo />
      </div>
    </div>
  );
}
