import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Get the origin from the request headers
  const origin = request.headers.get("origin");

  // Set CORS headers for all routes
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // Handle OPTIONS (preflight) requests
  if (request.method === "OPTIONS") {
    response.headers.set("Access-Control-Max-Age", "86400");
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/auth/:path*"],
};
