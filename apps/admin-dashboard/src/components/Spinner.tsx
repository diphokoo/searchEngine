export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div className={`d-flex justify-content-center align-items-center p-${size === 'sm' ? 2 : 5}`}>
      <div className={`spinner-border text-primary spinner-border-${size === 'sm' ? 'sm' : ''}`} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
    </div>
  )
}
