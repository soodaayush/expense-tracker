import { app } from "@azure/functions";
import { withCookies } from "../lib/http";
import { clearSessionCookie } from "../lib/session";
import { withErrors } from "../middleware/withAuth";

app.http("authLogout", {
  methods: ["POST"],
  route: "auth/logout",
  authLevel: "anonymous",
  handler: withErrors(async () => {
    return withCookies({ status: 200, jsonBody: { ok: true } }, [clearSessionCookie()]);
  }),
});
