"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-bold text-white print:hidden"
    >
      <Printer className="h-4 w-4" /> Print or save as PDF
    </button>
  );
}
