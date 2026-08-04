import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ColumnMapper from "../components/import/ColumnMapper";
import CsvDropzone from "../components/import/CsvDropzone";
import ImportPreviewTable from "../components/import/ImportPreviewTable";
import { IMPORT_CHUNK_SIZE, useImportBills } from "../hooks/useBills";
import { guessColumnMapping, normalizeRow, TargetField } from "../lib/csvValidation";
import { BillInput } from "../types/bill";

type Step = "upload" | "map" | "preview" | "importing" | "done";

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<TargetField, string | null>>({
    payee: null,
    amount: null,
    dueDate: null,
    paidDate: null,
    notes: null,
  });

  // The rows most recently handed to the mutation and how many of them are already known-attempted
  // from prior tries — lets a retry resend only what's left instead of the whole import.
  const [pendingRows, setPendingRows] = useState<BillInput[]>([]);
  const [importedBeforeThisAttempt, setImportedBeforeThisAttempt] = useState(0);

  const importMutation = useImportBills();

  const validatedRows = useMemo(() => rawRows.map((r) => normalizeRow(r, mapping)), [rawRows, mapping]);

  function handleParsed(h: string[], rows: Record<string, string>[]) {
    setHeaders(h);
    setRawRows(rows);
    setMapping(guessColumnMapping(h));
    setStep("map");
  }

  function startImport(rows: BillInput[]) {
    setPendingRows(rows);
    setStep("importing");
    importMutation.mutate(rows, { onSuccess: () => setStep("done") });
  }

  function handleImport() {
    const validInputs = validatedRows.filter((r) => r.valid).map((r) => r.input);
    setImportedBeforeThisAttempt(0);
    startImport(validInputs);
  }

  function handleRetry() {
    const attempted = Math.min(
      (importMutation.progress?.completedChunks ?? 0) * IMPORT_CHUNK_SIZE,
      pendingRows.length
    );
    setImportedBeforeThisAttempt((prev) => prev + attempted);
    startImport(pendingRows.slice(attempted));
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Import bills from CSV</h1>
        <Link to="/" className="btn-link">
          Back to bills
        </Link>
      </header>

      {step === "upload" && <CsvDropzone onParsed={handleParsed} />}

      {step === "map" && (
        <>
          <ColumnMapper headers={headers} mapping={mapping} onChange={setMapping} />
          <button className="btn btn-primary" onClick={() => setStep("preview")}>
            Preview
          </button>
        </>
      )}

      {step === "preview" && (
        <>
          <ImportPreviewTable rows={validatedRows} />
          <div className="import-actions">
            <button className="btn-link" onClick={() => setStep("map")}>
              Back to mapping
            </button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={importMutation.isPending || !validatedRows.some((r) => r.valid)}
            >
              Import {validatedRows.filter((r) => r.valid).length} bills
            </button>
          </div>
        </>
      )}

      {step === "importing" && (
        <div>
          {importMutation.isError ? (
            <>
              <p className="auth-error">
                Import stopped partway ({(importMutation.error as Error).message}). {importedBeforeThisAttempt}{" "}
                of {pendingRows.length + importedBeforeThisAttempt} bills were saved before it failed — the rest
                haven't been sent.
              </p>
              <button className="btn btn-primary" onClick={handleRetry}>
                Retry remaining {pendingRows.length - (importMutation.progress?.completedChunks ?? 0) * IMPORT_CHUNK_SIZE} bills
              </button>
            </>
          ) : (
            <p>
              Importing… {importMutation.progress?.inserted ?? 0} of {pendingRows.length} bills saved
              {importMutation.progress
                ? ` (batch ${importMutation.progress.completedChunks} of ${importMutation.progress.totalChunks})`
                : ""}
            </p>
          )}
        </div>
      )}

      {step === "done" && importMutation.data && (
        <div>
          <p>
            Imported {importedBeforeThisAttempt + importMutation.data.inserted} bills.{" "}
            {importMutation.data.errors.length > 0 && `${importMutation.data.errors.length} rows failed.`}
          </p>
          {importMutation.data.errors.length > 0 && (
            <ul>
              {importMutation.data.errors.map((e) => (
                <li key={e.rowIndex}>
                  Row {e.rowIndex + 1}: {e.message}
                </li>
              ))}
            </ul>
          )}
          <Link to="/" className="btn btn-primary">
            View bills
          </Link>
        </div>
      )}
    </div>
  );
}
