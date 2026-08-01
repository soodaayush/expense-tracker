import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { deleteBill } from "../lib/tables";
import { withAuth } from "../middleware/withAuth";

app.http("billsDelete", {
  methods: ["DELETE"],
  route: "bills/{id}",
  authLevel: "anonymous",
  handler: withAuth(async (request) => {
    const id = request.params.id;
    if (!id) throw new HttpError(400, "missing_id");

    try {
      await deleteBill(id);
      return { status: 200, jsonBody: { ok: true } };
    } catch (err) {
      if ((err as { statusCode?: number })?.statusCode === 404) throw new HttpError(404, "bill_not_found");
      throw err;
    }
  }),
});
