import { app } from "@azure/functions";
import { listBills } from "../lib/tables";
import { withAuth } from "../middleware/withAuth";

app.http("billsList", {
  methods: ["GET"],
  route: "bills",
  authLevel: "anonymous",
  handler: withAuth(async () => {
    const bills = await listBills();
    return { status: 200, jsonBody: { bills } };
  }),
});
