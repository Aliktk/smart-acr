"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { getAcrDetail } from "@/api/client";
import { FormPreview } from "@/components/FormPreview";
import type { AcrReviewerContext } from "@/types/contracts";

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-");
}

export default function AcrPrintPage() {
  const params = useParams<{ id: string }>();
  const { data, error, isLoading } = useQuery({
    queryKey: ["acr-print", params.id],
    queryFn: () => getAcrDetail(params.id),
    retry: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function syncPdfState() {
      if (typeof document === "undefined") {
        return;
      }

      document.body.dataset.pdfState = "loading";
      delete document.body.dataset.pdfError;
      delete document.body.dataset.pdfFilename;

      if (isLoading) {
        return;
      }

      if (error instanceof Error) {
        document.body.dataset.pdfState = "error";
        document.body.dataset.pdfError = error.message;
        return;
      }

      if (!data) {
        document.body.dataset.pdfState = "error";
        document.body.dataset.pdfError = "Unable to load the ACR document for PDF export.";
        return;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 450));
      const images = Array.from(document.images);
      await Promise.allSettled(
        images
          .filter((image) => !image.complete)
          .map(
            (image) =>
              new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              }),
          ),
      );

      if (cancelled) {
        return;
      }

      document.body.dataset.pdfFilename = sanitizeFileName(data.acrNo);
      document.body.dataset.pdfState = "ready";
    }

    void syncPdfState();

    return () => {
      cancelled = true;
      if (typeof document !== "undefined") {
        delete document.body.dataset.pdfState;
        delete document.body.dataset.pdfError;
        delete document.body.dataset.pdfFilename;
      }
    };
  }, [data, error, isLoading]);

  if (error instanceof Error) {
    return (
      <main className="min-h-screen bg-white px-8 py-10">
        <div className="mx-auto max-w-3xl rounded-[20px] border border-[#FECACA] bg-[#FFF1F2] px-6 py-5">
          <p className="text-base font-semibold text-[#991B1B]">Unable to prepare PDF export</p>
          <p className="mt-2 text-sm text-[#B91C1C]">{error.message}</p>
        </div>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main className="min-h-screen bg-white px-8 py-10">
        <div className="mx-auto max-w-3xl rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] px-6 py-5 text-sm text-[#475569]">
          Preparing the official ACR document for export...
        </div>
      </main>
    );
  }

  const reviewerContext: AcrReviewerContext = {
    reporting: {
      name: data.reportingOfficer,
      designation: data.reportingOfficerDesignation,
    },
    countersigning: data.countersigningOfficer
      ? {
          name: data.countersigningOfficer,
          designation: data.countersigningOfficerDesignation ?? "Countersigning Officer",
        }
      : null,
  };

  return (
    <main className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#475569]">
          <div>
            <p className="font-semibold text-[#111827]">{data.acrNo}</p>
            <p className="mt-1">
              {data.employee.name} · {data.employee.rank} · {data.reportingPeriod}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-[#111827]">{data.status}</p>
            <p className="mt-1">Generated for official PDF export</p>
          </div>
        </div>

        <div className="bg-white">
          <FormPreview
            templateFamily={data.templateFamily}
            editable={false}
            formData={data.formData ?? undefined}
            acrRecordId={data.id}
            reviewerContext={reviewerContext}
          />
        </div>
      </div>
    </main>
  );
}
