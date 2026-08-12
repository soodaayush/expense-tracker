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
