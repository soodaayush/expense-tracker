import { app } from "@azure/functions";
import { HttpError } from "../lib/errors";
import { validateImportRow } from "../lib/csv";
import { ImportResult, ImportRowInput } from "../shared/types";
import { bulkCreateBills } from "../lib/db";
import { withAuth } from "../middleware/withAuth";

interface ImportBody {
  rows: unknown[];
}

// Caps how many rows a single request can carry — the client chunks large imports into
// requests of this size or smaller; this is the server-side backstop against an unbounded
// batch ever again tying up one request (the failure mode behind the 10k-row prod incident).
const MAX_IMPORT_ROWS = 1000;

app.http("billsImport", {
  methods: ["POST"],
  route: "bills/import",
  authLevel: "anonymous",
  handler: withAuth(async (request, _context, session) => {
    const body = (await request.json().catch(() => null)) as ImportBody | null;
    if (!body || !Array.isArray(body.rows)) throw new HttpError(400, "rows must be an array");
    if (body.rows.length > MAX_IMPORT_ROWS) {
      throw new HttpError(400, `rows must not exceed ${MAX_IMPORT_ROWS} per request — send in smaller batches`);
    }

    const result: ImportResult = { inserted: 0, errors: [] };
    const validRows: { rowIndex: number; row: ImportRowInput }[] = [];

    for (let i = 0; i < body.rows.length; i++) {
      const validation = validateImportRow(body.rows[i]);
      if (!validation.ok) {
        result.errors.push({ rowIndex: i, message: validation.message });
        continue;
      }
      validRows.push({ rowIndex: i, row: validation.row });
    }

    if (validRows.length > 0) {
      try {
        const { inserted } = await bulkCreateBills(
          session.userId,
          validRows.map((v) => v.row)
        );
        result.inserted = inserted;
      } catch (err) {
        const message = (err as Error).message ?? "insert_failed";
        for (const v of validRows) {
          result.errors.push({ rowIndex: v.rowIndex, message });
        }
      }
    }

    return { status: 200, jsonBody: result };
  }),
});
