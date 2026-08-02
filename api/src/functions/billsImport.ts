import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { validateImportRow } from "../lib/csv";
import { ImportResult } from "../shared/types";
import { createBill } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

interface ImportBody {
  rows: unknown[];
}

app.http("billsImport", {
  methods: ["POST"],
  route: "bills/import",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const body = (await request.json().catch(() => null)) as ImportBody | null;
    if (!body || !Array.isArray(body.rows)) throw new HttpError(400, "rows must be an array");

    const result: ImportResult = { inserted: 0, errors: [] };

    for (let i = 0; i < body.rows.length; i++) {
      const validation = validateImportRow(body.rows[i]);
      if (!validation.ok) {
        result.errors.push({ rowIndex: i, message: validation.message });
        continue;
      }
      try {
        await createBill(session.userId, validation.row);
        result.inserted++;
      } catch (err) {
        result.errors.push({ rowIndex: i, message: (err as Error).message ?? "insert_failed" });
      }
    }

    return { status: 200, jsonBody: result };
  }),
});
