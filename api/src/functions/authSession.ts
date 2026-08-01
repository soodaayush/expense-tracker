import { app } from "@azure/functions";
import { verifySessionCookie } from "../lib/session";
import { withErrors } from "../middleware/withAuth";

app.http("authSession", {
  methods: ["GET"],
  route: "auth/session",
  authLevel: "anonymous",
  handler: withErrors(async (request) => {
    const session = await verifySessionCookie(request);
    return { status: 200, jsonBody: { authenticated: !!session } };
  }),
});
