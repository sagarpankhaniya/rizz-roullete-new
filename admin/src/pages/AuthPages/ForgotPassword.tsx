import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import ForgotPasswordForm from "../../components/auth/ForgotPasswordForm";

export default function ForgotPassword() {
  return (
    <>
      <PageMeta
        title="Forgot Password | Rizz Outlet Admin"
        description="Request a password reset for Rizz Outlet admin"
      />
      <AuthLayout>
        <ForgotPasswordForm />
      </AuthLayout>
    </>
  );
}
