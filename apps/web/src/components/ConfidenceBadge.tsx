export type ConfidenceLevel = 'high' | 'medium' | 'low';

const LABEL: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};
const DOTS: Record<ConfidenceLevel, string> = {
  high: '\u25cf\u25cf\u25cf',
  medium: '\u25cf\u25cf\u25cb',
  low: '\u25cf\u25cb\u25cb',
};

/** Never relies on colour alone: always shows dots and a text label. */
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span className={`badge badge-${level}`}>
      <span aria-hidden="true">{DOTS[level]}</span>
      {LABEL[level]}
    </span>
  );
}
