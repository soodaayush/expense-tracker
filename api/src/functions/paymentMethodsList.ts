import { app } from "@azure/functions";
import { listPaymentMethods } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

app.http("paymentMethodsList", {
  methods: ["GET"],
  route: "payment-methods",
  authLevel: "anonymous",
  handler: withAuth(async (_request, _context, session) => {
    const paymentMethods = await listPaymentMethods(session.userId);
    return { status: 200, jsonBody: { paymentMethods } };
  }),
});
