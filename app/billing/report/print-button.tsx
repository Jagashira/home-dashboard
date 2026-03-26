"use client";

export function BillingReportPrintButton() {
  return (
    <button
      className="button-primary"
      type="button"
      onClick={() => {
        window.print();
      }}
    >
      PDF保存
    </button>
  );
}
