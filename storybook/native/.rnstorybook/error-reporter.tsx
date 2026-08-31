/**
 * On-device story error reporter for the native storybook harness.
 *
 * The on-device storybook is a RELEASE build: when a story crashes, the canvas
 * shows a generic red box at best — and an error that escapes the story's error
 * boundary (e.g. one thrown in an effect or an async callback) shows as a plain
 * white screen with the cause only in logcat. This reporter renders the ACTUAL
 * error message + stack on the canvas so a white story explains itself on the
 * device.
 *
 * Two capture paths:
 * 1. Render-phase errors: {@link StoryErrorBoundary} catches them and renders
 *    the message inline (the storybook boundary would only say "something went
 *    wrong").
 * 2. Effect / async errors: `ErrorUtils.setGlobalHandler` receives every
 *    uncaught JS error; the module-scope store feeds it to the mounted
 *    {@link GlobalErrorReporter} banner.
 */
import { Component, type ReactNode, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

let lastGlobalError: { message: string; stack?: string } | null = null;
const globalErrorListeners = new Set<() => void>();

function recordGlobalError(error: unknown) {
  lastGlobalError = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  for (const listener of globalErrorListeners) listener();
}

// Chain the RN default handler so LogBox / logcat still see the error.
const globalErrorHandler = globalThis.ErrorUtils?.getGlobalHandler?.();
if (globalThis.ErrorUtils?.setGlobalHandler)
  globalThis.ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    recordGlobalError(error);
    globalErrorHandler?.(error, isFatal);
  });

const ERROR_PANEL_STYLE = {
  borderColor: '#dc2626',
  borderWidth: 2,
  borderRadius: 8,
  padding: 12,
  marginTop: 12,
  marginBottom: 12,
  alignSelf: 'stretch' as const,
  backgroundColor: '#fef2f2',
};

type ErrorPanelProps = { title: string; message: string; stack?: string };
type StoryErrorBoundaryState = { error: { message: string; stack?: string } | null };

export function ErrorPanel({ title, message, stack }: ErrorPanelProps) {
  return (
    <View style={ERROR_PANEL_STYLE}>
      <Text style={{ color: '#991b1b', fontWeight: '700', fontSize: 14 }}>{title}</Text>
      <Text style={{ color: '#7f1d1d', fontSize: 13, marginTop: 4 }}>{message}</Text>
      {stack ? <Text style={{ color: '#7f1d1d', fontSize: 11, marginTop: 6 }}>{stack.slice(0, 1200)}</Text> : null}
    </View>
  );
}

/** Catches render-phase story crashes and shows the real error instead of a blank canvas. */
export class StoryErrorBoundary extends Component<{ children: ReactNode }, StoryErrorBoundaryState> {
  state: StoryErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }

  componentDidCatch(error: unknown) {
    console.error('Story render error:', error);
  }

  render() {
    if (this.state.error)
      return <ErrorPanel title="Story render error" message={this.state.error.message} stack={this.state.error.stack} />;
    return this.props.children;
  }
}

/** Shows the latest uncaught (effect/async) JS error, if any. */
export function GlobalErrorReporter() {
  const [, setTick] = useState(0);
  // biome-ignore lint/plugin: subscribing a mounted banner to the module-scope global-error store is a genuine side effect — it must not run during render
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    globalErrorListeners.add(listener);
    return () => {
      globalErrorListeners.delete(listener);
    };
  }, []);
  if (!lastGlobalError) return null;
  return <ErrorPanel title="Uncaught JS error (effect/async)" message={lastGlobalError.message} stack={lastGlobalError.stack} />;
}
