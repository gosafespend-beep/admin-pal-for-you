import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  /** Changing this (the route) clears a previous error, so moving to another page recovers without a reload. */
  resetKey: string;
  children: ReactNode;
}
interface State {
  error: Error | null;
  key: string;
}

/**
 * Keeps one broken page from blanking the whole panel. The sidebar and header stay
 * usable, the message says what to do, and the technical detail is one click away
 * for whoever needs to report it.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold">This page hit a problem</h1>
        <p className="text-sm text-muted-foreground">
          Nothing was changed. You can try again, or carry on with another page from the menu.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => this.setState({ error: null })}>Try again</Button>
          <Button variant="outline" asChild><Link to="/dashboard">Back to the dashboard</Link></Button>
        </div>
        <details className="w-full text-left text-xs text-muted-foreground">
          <summary className="cursor-pointer">Details for support</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-border/40 bg-card/50 p-3">{error.message}</pre>
        </details>
      </div>
    );
  }
}
