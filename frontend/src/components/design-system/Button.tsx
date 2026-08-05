import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

function buttonClassName(
  variant: "primary" | "secondary" = "primary",
  className = "",
) {
  return `ds-button ds-button--${variant} ${className}`.trim();
}

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName(variant, className)}
      type={type}
      {...props}
    />
  );
}

type ButtonLinkProps = Omit<LinkProps, "className"> & {
  className?: string;
  variant?: "primary" | "secondary";
};

export function ButtonLink({
  className = "",
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClassName(variant, className)} {...props} />;
}
