import { HttpResponseInit } from "@azure/functions";

export function withCookies(body: HttpResponseInit, cookies: string[]): HttpResponseInit {
  return {
    ...body,
    headers: cookies.map((cookie) => ["Set-Cookie", cookie] as [string, string]),
  };
}
