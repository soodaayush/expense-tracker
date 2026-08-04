import { useState } from "react";
import { Link } from "react-router-dom";
import CsvDropzone from "../components/import/CsvDropzone";
import { IMPORT_CHUNK_SIZE, useImportBills } from "../hooks/useBills";
import { guessColumnMapping, normalizeRow } from "../lib/csvValidation";
import { BillInput } from "../types/bill";

type Step = "upload" | "importing" | "done";

export default function ImportPage() {
  const [step, setStep] = useState<Step>("upload");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);

  // The rows most recently handed to the mutation and how many of them are already known-attempted
  // from prior tries — lets a retry resend only what's left instead of the whole import.
  const [pendingRows, setPendingRows] = useState<BillInput[]>([]);
  const [importedBeforeThisAttempt, setImportedBeforeThisAttempt] = useState(0);

  const importMutation = useImportBills();

  function handleParsed(headers: string[], rawRows: Record<string, string>[]) {
    const mapping = guessColumnMapping(headers);
    const validated = rawRows.map((r) => normalizeRow(r, mapping));
    const validInputs = validated.filter((r) => r.valid).map((r) => r.input);

    if (validInputs.length === 0) {
      setUploadError("No valid rows found — check that your CSV has recognizable Payee and Due Date columns.");
      return;
    }

    setUploadError(null);
    setSkippedCount(validated.length - validInputs.length);
    setImportedBeforeThisAttempt(0);
    startImport(validInputs);
  }

  function startImport(rows: BillInput[]) {
    setPendingRows(rows);
    setStep("importing");
    importMutation.mutate(rows, { onSuccess: () => setStep("done") });
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

      {step === "upload" && (
        <>
          <CsvDropzone onParsed={handleParsed} />
          {uploadError && <p className="auth-error">{uploadError}</p>}
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
            {importMutation.data.errors.length > 0 && `${importMutation.data.errors.length} rows failed. `}
            {skippedCount > 0 &&
              `${skippedCount} rows were skipped before import (unrecognized payee, due date, or amount).`}
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
