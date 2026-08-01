import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { validateBillPatch } from "../lib/csv";
import { updateBill } from "../lib/tables";
import { withAuth } from "../middleware/withAuth";

app.http("billsUpdate", {
  methods: ["PATCH"],
  route: "bills/{id}",
  authLevel: "anonymous",
  handler: withAuth(async (request) => {
    const id = request.params.id;
    if (!id) throw new HttpError(400, "missing_id");

    const body = await request.json().catch(() => null);
    const validation = validateBillPatch(body);
    if (!validation.ok) throw new HttpError(400, validation.message);

    try {
      const bill = await updateBill(id, validation.patch);
      return { status: 200, jsonBody: { bill } };
    } catch (err) {
      if ((err as { statusCode?: number })?.statusCode === 404) throw new HttpError(404, "bill_not_found");
      throw err;
    }
  }),
});
