import { Suspense } from "react";
import { QueueClientPage } from "./queue-client";

export default function QueuePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading queue...</div>}>
      <QueueClientPage />
    </Suspense>
  );
}
