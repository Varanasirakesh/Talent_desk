import { demoPortalResponse } from "../../../features/hr/portal-fixture";

export const dynamic = "force-static";

export function GET() {
  return Response.json(demoPortalResponse);
}
