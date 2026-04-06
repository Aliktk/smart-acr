import type { QueryClient } from "@tanstack/react-query";
import type { AcrSummary, ApiListResponse, DashboardOverview } from "@/types/contracts";

function replaceAcrSummary<T extends AcrSummary>(item: T, updated: AcrSummary) {
  return {
    ...item,
    ...updated,
    employee: updated.employee,
  } as T;
}

export function syncAcrSummaryCaches(queryClient: QueryClient, updated: AcrSummary) {
  queryClient.setQueriesData<ApiListResponse<AcrSummary>>({ queryKey: ["acrs"] }, (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      items: current.items.map((item) => (item.id === updated.id ? replaceAcrSummary(item, updated) : item)),
    };
  });

  queryClient.setQueryData<DashboardOverview>(["dashboard-overview"], (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      items: current.items.map((item) => (item.id === updated.id ? replaceAcrSummary(item, updated) : item)),
    };
  });
}
