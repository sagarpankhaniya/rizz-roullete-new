import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign In | Rizz Outlet Admin"
        description="Sign in to Rizz Outlet admin"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
