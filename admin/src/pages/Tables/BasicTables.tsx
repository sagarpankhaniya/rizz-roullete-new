import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import BasicTableOne from "../../components/tables/BasicTables/BasicTableOne";

export default function BasicTables() {
  return (
    <>
      <PageMeta
        title="Tables | Rizz Outlet Admin"
        description="Table components"
      />
      <PageBreadcrumb pageTitle="Tables" />
      <div className="space-y-6">
        <ComponentCard title="Basic Table">
          <BasicTableOne />
        </ComponentCard>
      </div>
    </>
  );
}
