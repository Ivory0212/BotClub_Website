import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hydrateTotalVisitsFromDiskOnce, recordSessionPing } from "@/lib/site-stats";

export const dynamic = "force-dynamic";

const COOKIE = "bc_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export async function GET() {
  await hydrateTotalVisitsFromDiskOnce();

  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  const isNew = !existing;
  const sessionId = existing ?? crypto.randomUUID();

  const { online, totalVisits } = recordSessionPing(sessionId, isNew);

  const res = NextResponse.json(
    { online, totalVisits },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );

  if (isNew) {
    res.cookies.set(COOKIE, sessionId, {
      path: "/",
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return res;
}
