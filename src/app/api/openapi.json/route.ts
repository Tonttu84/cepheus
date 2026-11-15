import { respond } from "@/server/api";
import { getOpenApiDocument } from "@/server/openapi";

export const dynamic = "force-dynamic";

/** The OpenAPI 3.1 document of the product API. */
export async function GET() {
  return respond(getOpenApiDocument());
}
