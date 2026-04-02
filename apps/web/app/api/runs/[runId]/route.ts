import { NextResponse } from "next/server";

import { generateDecisionPackForRun, getRunById, processSimulationRun } from "@bgc-alpha/db";

import { authorizeApiRequest } from "@/lib/auth-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authResult = await authorizeApiRequest(["runs.read"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { runId } = await params;
  const run = await getRunById(runId);

  if (!run) {
    return NextResponse.json(
      {
        error: "run_not_found"
      },
      {
        status: 404
      }
    );
  }

  return NextResponse.json({
    run
  });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authResult = await authorizeApiRequest(["runs.write"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { runId } = await params;
  const run = await getRunById(runId);

  if (!run) {
    return NextResponse.json(
      {
        error: "run_not_found"
      },
      {
        status: 404
      }
    );
  }

  if (!process.env.VERCEL) {
    return NextResponse.json(
      {
        error: "inline_run_processing_unavailable",
        run
      },
      {
        status: 409
      }
    );
  }

  if (run.status === "QUEUED") {
    const processedRun = await processSimulationRun(runId);

    return NextResponse.json({
      run: processedRun
    });
  }

  if (run.status === "COMPLETED" && !run.decisionPacks[0]) {
    await generateDecisionPackForRun(runId, [], []);

    return NextResponse.json({
      run: await getRunById(runId)
    });
  }

  return NextResponse.json({
    run
  });
}
