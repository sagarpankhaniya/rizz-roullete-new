import { useState } from "react";
import { Link } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import { forgotAdminPassword, getApiErrorMessage } from "../../api/auth";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => forgotAdminPassword(email.trim()),
    onSuccess: (data) => {
      toast.success(data.message || "Reset link sent");
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, "Failed to send reset link"));
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-5 text-center sm:mb-8">
        <h1 className="text-title-sm sm:text-title-md mb-2 font-semibold text-gray-800 dark:text-white/90">
          Forgot Password
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter the email address linked to your account and we&apos;ll send you
          a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <div>
            <Label>
              Email <span className="text-error-500">*</span>
            </Label>
            <Input
              type="email"
              name="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <Button
              className="w-full"
              size="sm"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Sending..." : "Send Reset Link"}
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-5">
        <p className="text-center text-sm font-normal text-gray-700 dark:text-gray-400">
          Remember your password?{" "}
          <Link
            to="/signin"
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
