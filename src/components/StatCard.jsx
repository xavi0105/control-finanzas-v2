export default function StatCard({ label, value, currency, badge, badgeTone = 'emerald', sub, up }) {
  return (
    <div className="stat-card">
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {badge && <span className={`stat-badge badge-${badgeTone}`}>{badge}</span>}
      </div>
      <div className="stat-value">
        {value} {currency && <span className="cur">{currency}</span>}
      </div>
      {sub && (
        <p className="stat-sub">
          {up && <span className="up">▲ </span>}
          {sub}
        </p>
      )}
    </div>
  )
}