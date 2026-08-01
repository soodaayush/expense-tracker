import { app } from "@azure/functions";
import { listPayees } from "../lib/tables";
import { withAuth } from "../middleware/withAuth";

app.http("payeesList", {
  methods: ["GET"],
  route: "payees",
  authLevel: "anonymous",
  handler: withAuth(async () => {
    const payees = await listPayees();
    return { status: 200, jsonBody: { payees } };
  }),
});
