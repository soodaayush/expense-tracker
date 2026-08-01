import { HttpResponseInit } from "@azure/functions";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(err: unknown): HttpResponseInit {
  if (err instanceof HttpError) {
    return { status: err.status, jsonBody: { error: err.message } };
  }
  console.error(err);
  return { status: 500, jsonBody: { error: "internal_error" } };
}
