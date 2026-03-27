import { Card } from "@/components/ui/card";

export default function StoragePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Card className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Restricted Entry
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Storage</h1>
          <p className="text-sm leading-6 text-slate-600">
            This page will become the NAS and storage management area for the home dashboard.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm leading-6 text-slate-700">
            It is intended to be served as a dedicated page behind nginx, with access control handled
            at the proxy layer. For now, this is a placeholder entry point for future storage
            features.
          </p>
        </div>
      </Card>
    </main>
  );
}
