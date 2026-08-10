import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { updatePayee } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

interface UpdateBody {
  name?: string;
}

app.http("payeesUpdate", {
  methods: ["PATCH"],
  route: "payees/{id}",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const id = request.params.id;
    if (!id) throw new HttpError(400, "missing_id");

    const body = (await request.json().catch(() => null)) as UpdateBody | null;
    const name = body?.name?.trim();
    if (!name) throw new HttpError(400, "name is required");
    if (name.length > 200) throw new HttpError(400, "name is too long");

    try {
      const payee = await updatePayee(session.userId, id, name);
      return { status: 200, jsonBody: { payee } };
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404) throw new HttpError(404, "payee_not_found");
      if (statusCode === 409) throw new HttpError(409, (err as Error).message);
      throw err;
    }
  }),
});
