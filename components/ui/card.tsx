import { PropsWithChildren } from "react";

export function Card({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>{children}</section>;
}

