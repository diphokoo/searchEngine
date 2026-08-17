interface Props { score: number }

export default function ConfidenceScore({ score }: Props) {
  const cls = score >= 80 ? 'confidence-high' : score >= 60 ? 'confidence-medium' : 'confidence-low'
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171'
  return (
    <div>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color, marginBottom: '3px' }}>{score}%</div>
      <div className="confidence-bar" style={{ width: 80 }}>
        <div className={`confidence-fill ${cls}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  )
}
