import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { createBill } from "../lib/tables";
import { withAuth } from "../middleware/withAuth";
import { validateImportRow } from "../lib/csv";

app.http("billsCreate", {
  methods: ["POST"],
  route: "bills",
  authLevel: "anonymous",
  handler: withAuth(async (request) => {
    const body = await request.json().catch(() => null);
    const validation = validateImportRow(body);
    if (!validation.ok) throw new HttpError(400, validation.message);

    const bill = await createBill(validation.row);
    return { status: 201, jsonBody: { bill } };
  }),
});
