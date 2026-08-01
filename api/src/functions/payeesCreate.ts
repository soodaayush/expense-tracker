import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { ensurePayeeKnown, listPayees } from "../lib/tables";
import { withAuth } from "../middleware/withAuth";

interface CreateBody {
  name?: string;
}

app.http("payeesCreate", {
  methods: ["POST"],
  route: "payees",
  authLevel: "anonymous",
  handler: withAuth(async (request) => {
    const body = (await request.json().catch(() => null)) as CreateBody | null;
    const name = body?.name?.trim();
    if (!name) throw new HttpError(400, "name is required");
    if (name.length > 200) throw new HttpError(400, "name is too long");

    await ensurePayeeKnown(name);
    const payees = await listPayees();
    return { status: 201, jsonBody: { payees } };
  }),
});
