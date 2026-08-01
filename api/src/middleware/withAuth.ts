import { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { errorResponse } from "../lib/errors";
import { SessionPayload, verifySessionCookie } from "../lib/session";

type AuthedHandler = (
  request: HttpRequest,
  context: InvocationContext,
  session: SessionPayload
) => Promise<HttpResponseInit>;

export function withAuth(handler: AuthedHandler): HttpHandler {
  return async (request, context) => {
    try {
      const session = await verifySessionCookie(request);
      if (!session) {
        return { status: 401, jsonBody: { error: "unauthorized" } };
      }
      return await handler(request, context, session);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function withErrors(handler: HttpHandler): HttpHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
