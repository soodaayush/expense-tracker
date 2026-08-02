import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { createBill } from "../lib/db";
import { withAuth } from "../middleware/withAuth";
import { validateImportRow } from "../lib/csv";

app.http("billsCreate", {
  methods: ["POST"],
  route: "bills",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const body = await request.json().catch(() => null);
    const validation = validateImportRow(body);
    if (!validation.ok) throw new HttpError(400, validation.message);

    const bill = await createBill(session.userId, validation.row);
    return { status: 201, jsonBody: { bill } };
  }),
});
