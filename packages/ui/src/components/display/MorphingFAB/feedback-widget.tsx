/**
 * @deprecated Renamed to `FeedbackFAB` (import from `rn-motion-ui/morphing-fab`
 * or `rn-motion-ui/feedback-fab`). This re-export keeps the pre-5.3.0 subpath
 *  `rn-motion-ui/feedback-widget` working without a breaking change.
 */
// biome-ignore lint/performance/noBarrelFile: intentional deprecation shim — re-exports FeedbackFAB under the pre-rename name so the old subpath keeps working
export { type FeedbackData, FeedbackFAB as FeedbackWidget, type FeedbackFABProps as FeedbackWidgetProps } from './feedback-fab';
