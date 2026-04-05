import { Suspense } from "react";
import { SearchClientPage } from "./search-client";

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading search...</div>}>
      <SearchClientPage />
    </Suspense>
  );
}
