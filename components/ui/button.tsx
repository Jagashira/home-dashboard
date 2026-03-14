import { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 ${props.className ?? ""}`}
    />
  );
}

