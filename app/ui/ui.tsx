"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";
import Link from "next/link";
import type { ReactNode } from "react";
type ButtonProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};
function Button({
  children,
  href,
  onClick,
  disabled,
  variant,
}: ButtonProps & { variant: string }) {
  return href ? (
    <Link className={variant} href={href}>
      {children}
    </Link>
  ) : (
    <button className={variant} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
export function PrimaryButton(props: ButtonProps) {
  return <Button {...props} variant="primary" />;
}
export function SecondaryButton(props: ButtonProps) {
  return <Button {...props} variant="secondary" />;
}
export function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t: tr } = useJupLocale();

  return (
    <section className="panel">
      <h3>{tr(title)}</h3>
      {subtitle && <p>{tr(subtitle)}</p>}
      {children}
    </section>
  );
}
export function Pill({ text, tone }: { text: string; tone?: string }) {
  return <span className={"pill " + (tone ?? "")}>{text}</span>;
}
