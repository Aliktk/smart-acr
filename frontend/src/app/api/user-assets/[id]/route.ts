import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const requestUrl = new URL(request.url);
  const acrId = requestUrl.searchParams.get("acrId");
  const upstreamUrl = new URL(`${apiBase()}/user-assets/${id}/content`);

  if (acrId) {
    upstreamUrl.searchParams.set("acrId", acrId);
  }

  const upstream = await fetch(upstreamUrl, {
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse("Unable to load profile asset.", { status: upstream.status });
  }

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Cache-Control": upstream.headers.get("cache-control") ?? "private, max-age=300",
    },
  });
}
