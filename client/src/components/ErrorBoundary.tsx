import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Without this, an uncaught render error anywhere in the tree unmounts the
// whole app and leaves a blank white page with no way back short of the
// user guessing to hit refresh — this catches it and offers that refresh
// as an actual button, plus logs the error for debugging.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error in component tree:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-bold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            This page hit an unexpected error. Refreshing usually fixes it.
          </p>
          <Button onClick={() => window.location.reload()}>Refresh page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
