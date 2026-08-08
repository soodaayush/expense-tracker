import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { deletePaymentMethod } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

app.http("paymentMethodsDelete", {
  methods: ["DELETE"],
  route: "payment-methods/{id}",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const id = request.params.id;
    if (!id) throw new HttpError(400, "missing_id");

    try {
      await deletePaymentMethod(session.userId, id);
      return { status: 200, jsonBody: { ok: true } };
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404) throw new HttpError(404, "payment_method_not_found");
      if (statusCode === 409) throw new HttpError(409, (err as Error).message);
      throw err;
    }
  }),
});
