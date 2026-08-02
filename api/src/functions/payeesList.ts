import { app } from "@azure/functions";
import { listPayees } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

app.http("payeesList", {
  methods: ["GET"],
  route: "payees",
  authLevel: "anonymous",
  handler: withAuth(async (_request, _context, session) => {
    const payees = await listPayees(session.userId);
    return { status: 200, jsonBody: { payees } };
  }),
});
