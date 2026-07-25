import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "react-toastify";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useAuth } from "../../context/AuthContext";
import { getApiErrorMessage } from "../../api/auth";

export default function SignInForm() {
  const navigate = useNavigate();
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    try {
      await login({ email: email.trim(), password, remember });
      toast.success("Signed in successfully");
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Invalid email or password"));
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-5 text-center sm:mb-8">
        <h1 className="text-title-sm sm:text-title-md mb-2 font-semibold text-gray-800 dark:text-white/90">
          Sign In
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter your email and password to sign in!
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
            <Label>
              Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Enter your password"
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox checked={remember} onChange={setRemember} />
              <span className="text-theme-sm block font-normal text-gray-700 dark:text-gray-400">
                Keep me logged in
              </span>
            </div>
            <Link
              to="/forgot-password"
              className="text-brand-500 hover:text-brand-600 dark:text-brand-400 text-sm"
            >
              Forgot password?
            </Link>
          </div>

          <div>
            <Button className="w-full" size="sm" type="submit" disabled={isLoggingIn}>
              {isLoggingIn ? "Signing in..." : "Sign in"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
