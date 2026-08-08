import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { ensurePaymentMethodKnown, listPaymentMethods } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

interface CreateBody {
  name?: string;
}

app.http("paymentMethodsCreate", {
  methods: ["POST"],
  route: "payment-methods",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const body = (await request.json().catch(() => null)) as CreateBody | null;
    const name = body?.name?.trim();
    if (!name) throw new HttpError(400, "name is required");
    if (name.length > 200) throw new HttpError(400, "name is too long");

    await ensurePaymentMethodKnown(session.userId, name);
    const paymentMethods = await listPaymentMethods(session.userId);
    return { status: 201, jsonBody: { paymentMethods } };
  }),
});
