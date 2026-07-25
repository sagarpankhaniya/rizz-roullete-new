import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import { getApiErrorMessage, resetAdminPassword } from "../../api/auth";

export default function ResetPasswordForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: () => resetAdminPassword(token, password),
    onSuccess: (data) => {
      toast.success(data.message || "Password updated successfully");
      setTimeout(() => navigate("/signin", { replace: true }), 1200);
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to reset password"));
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!token) {
      toast.error("Reset token is missing. Use the link from your email.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    mutation.mutate();
  }

  if (!token) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-title-sm sm:text-title-md mb-2 font-semibold text-gray-800 dark:text-white/90">
          Invalid Reset Link
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          This reset link is missing or invalid. Request a new one.
        </p>
        <Link
          to="/forgot-password"
          className="text-brand-500 hover:text-brand-600 dark:text-brand-400 text-sm"
        >
          Forgot password
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-5 text-center sm:mb-8">
        <h1 className="text-title-sm sm:text-title-md mb-2 font-semibold text-gray-800 dark:text-white/90">
          Reset Password
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter your new password below.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div>
            <Label>
              New Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-4 z-30 -translate-y-1/2 cursor-pointer"
              >
                {showPassword ? (
                  <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                ) : (
                  <EyeCloseIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                )}
              </span>
            </div>
          </div>
          <div>
            <Label>
              Confirm Password <span className="text-error-500">*</span>
            </Label>
            <Input
              type={showPassword ? "text" : "password"}
              name="confirmPassword"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div>
            <Button
              className="w-full"
              size="sm"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-5">
        <p className="text-center text-sm font-normal text-gray-700 dark:text-gray-400">
          <Link
            to="/signin"
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
