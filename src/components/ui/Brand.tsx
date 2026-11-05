import { Link } from 'react-router'
export function Brand({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className="brand" aria-label="Citas Médicas sin Barreras, inicio">
    <span className="brand__mark" aria-hidden="true"><i /><i /></span>
    {!compact ? <span className="brand__text">Citas Médicas <small>sin Barreras</small></span> : null}
  </Link>
}
