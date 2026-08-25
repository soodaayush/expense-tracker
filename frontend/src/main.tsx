import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/theme.css";
import "./styles/grid.css";
import "./styles/reports.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A couple of retries gives a query a real chance to ride out an Azure SQL serverless
      // cold-start blip (see SlowRequestBanner) instead of failing outright on the first flaky
      // attempt right after the database resumes.
      retry: 2,
      refetchOnWindowFocus: false,
      // Without this, every route change remounts a query and — since the default staleTime is
      // 0 — refetches from the database immediately, even when nothing has changed since the
      // last fetch. Every mutation already explicitly invalidates the queries it affects, so
      // this only suppresses *redundant* refetches, not real ones; it directly cuts how often
      // the database gets touched during ordinary browsing (Bills ↔ Reports ↔ Notifications),
      // which matters for staying inside the free-tier serverless vCore-second budget.
      staleTime: 5 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
