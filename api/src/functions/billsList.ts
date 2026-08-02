import { app } from "@azure/functions";
import { listBills } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

app.http("billsList", {
  methods: ["GET"],
  route: "bills",
  authLevel: "anonymous",
  handler: withAuth(async (_request, _context, session) => {
    const bills = await listBills(session.userId);
    return { status: 200, jsonBody: { bills } };
  }),
});
