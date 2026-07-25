import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: "default" | "danger";
  children: ReactNode;
};

const baseClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-50";

const toneClass = {
  default:
    "ring-gray-300 hover:bg-gray-50 dark:ring-gray-700 dark:hover:bg-white/[0.03]",
  danger:
    "ring-error-300 text-error-600 hover:bg-error-50 dark:ring-error-500/40 dark:text-error-400 dark:hover:bg-error-500/10",
};

export default function IconActionButton({
  label,
  tone = "default",
  children,
  className = "",
  type = "button",
  ...props
}: IconActionButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={`${baseClass} ${toneClass[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
