export default function AppFooter() {
  return (
    <footer className="shrink-0 border-t border-gray-200 px-4 py-4 dark:border-gray-800 md:px-6">
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        &copy; {new Date().getFullYear()} Rizz Outlet. All rights reserved.
      </p>
    </footer>
  );
}
