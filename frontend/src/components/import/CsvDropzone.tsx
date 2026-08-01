import Papa from "papaparse";
import { useRef, useState } from "react";

interface CsvDropzoneProps {
  onParsed: (headers: string[], rows: Record<string, string>[]) => void;
}

export default function CsvDropzone({ onParsed }: CsvDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function parseFile(file: File) {
    setError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length) {
          setError(results.errors[0].message);
          return;
        }
        onParsed(results.meta.fields ?? [], results.data);
      },
      error: (err) => setError(err.message),
    });
  }

  return (
    <div
      className={`dropzone${dragging ? " dropzone-active" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) parseFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) parseFile(file);
        }}
      />
      <p>Drop a CSV file here, or click to choose one.</p>
      {error && <p className="auth-error">{error}</p>}
    </div>
  );
}
