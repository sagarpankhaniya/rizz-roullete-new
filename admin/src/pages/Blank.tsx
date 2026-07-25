import PageMeta from "../components/common/PageMeta";

export default function Blank() {
  return (
    <div>
      <PageMeta
        title="Dashboard | Rizz Outlet Admin"
        description="Rizz Outlet admin dashboard"
      />
      <div className="min-h-[420px] rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12">
        <div className="mx-auto w-full max-w-[630px] text-center">
          <h3 className="text-theme-xl mb-4 font-semibold text-gray-800 sm:text-2xl dark:text-white/90">
            Welcome to Admin
          </h3>
          <p className="text-sm text-gray-500 sm:text-base dark:text-gray-400">
            Start building your admin screens with the shared layout and form
            components.
          </p>
        </div>
      </div>
    </div>
  );
}
