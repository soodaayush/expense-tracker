import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { deletePayee } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

app.http("payeesDelete", {
  methods: ["DELETE"],
  route: "payees/{id}",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const id = request.params.id;
    if (!id) throw new HttpError(400, "missing_id");

    try {
      await deletePayee(session.userId, id);
      return { status: 200, jsonBody: { ok: true } };
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404) throw new HttpError(404, "payee_not_found");
      if (statusCode === 409) throw new HttpError(409, (err as Error).message);
      throw err;
    }
  }),
});
