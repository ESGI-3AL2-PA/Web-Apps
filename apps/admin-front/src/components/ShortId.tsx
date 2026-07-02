// Renders a truncated id with the full value available on hover (title) so it isn't unrecoverable.
export function ShortId({ value }: { value?: string | null }) {
  if (!value) return <>—</>;
  const short = value.length > 10 ? `${value.slice(0, 8)}…` : value;
  return (
    <span title={value} className="font-mono text-xs">
      {short}
    </span>
  );
}
