// app/api/get-ids/[key]/route.ts

import { NextResponse } from "next/server";
import { getIdsFromThreadKey } from "@/app/lib/id-parser";

// Note: The 'context' object's 'params' property is a Promise in this Next.js version.
export async function GET(
  request: Request,
  context: { params: Promise<{ key: string }> }
) {
  const { key: threadKey } = await context.params;

  if (!threadKey) {
    return NextResponse.json(
      { error: "Thread key is required" },
      { status: 400 }
    );
  }

  try {
    const ids = await getIdsFromThreadKey(threadKey);
    return NextResponse.json({ ids });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: "Failed to fetch data", details: errorMessage },
      { status: 500 }
    );
  }
}
