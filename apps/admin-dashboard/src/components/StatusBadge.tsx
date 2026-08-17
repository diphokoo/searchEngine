interface Props { status: string }

export default function StatusBadge({ status }: Props) {
  return <span className={`badge-status badge-${status}`}>{status.replace('_', ' ')}</span>
}
