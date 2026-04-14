"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SessionExpiredError } from "@/api/client";
import { AppShellProvider } from "./ShellProvider";
import { ThemeProvider } from "./ThemeProvider";
import { clientLogger } from "@/utils/logger";

function redirectToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    const destination = window.location.pathname + window.location.search;
    const loginUrl = destination !== "/" ? `/login?redirect=${encodeURIComponent(destination)}` : "/login";
    window.location.replace(loginUrl);
  }
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            if (error instanceof SessionExpiredError) {
              redirectToLogin();
              return;
            }
            clientLogger.error(
              `Query failed: ${(query.queryKey as string[]).join("/")}`,
              error,
              "ReactQuery",
            );
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _variables, _context, mutation) => {
            if (error instanceof SessionExpiredError) {
              redirectToLogin();
              return;
            }
            clientLogger.error(
              `Mutation failed: ${mutation.options.mutationKey?.join("/") ?? "unknown"}`,
              error,
              "ReactQuery",
            );
          },
        }),
      }),
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AppShellProvider>{children}</AppShellProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
