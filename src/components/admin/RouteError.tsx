import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The last line of defence: anything that escapes a page's own error handling lands here instead of a blank screen. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : "Unknown error";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">{notFound ? "That page doesn't exist" : "Something went wrong"}</h1>
        <p className="text-sm text-muted-foreground">
          {notFound ? "The link may be old or mistyped." : "Nothing was changed. Reloading usually fixes it."}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => { window.location.href = "/dashboard"; }}>Go to the dashboard</Button>
        </div>
        <details className="w-full text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer">Details for support</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-border/40 bg-card/50 p-3">{detail}</pre>
        </details>
      </div>
    </main>
  );
}
