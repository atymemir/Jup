
export function LoadingState({ label = "Готовим всё для учёбы…", compact = false }: { label?: string; compact?: boolean }) {
  return compact ? (
    <span className="loadingInline" role="status"><span className="loadingOrbit" aria-hidden="true" />{label}</span>
  ) : (
    <section className="loadingState" aria-busy="true" aria-label={label}>
      <div className="loadingIdentity"><span className="loadingOrbit" aria-hidden="true" /><p role="status">{label}</p><span className="loadingTrack" aria-hidden="true" /></div>
      <div className="loadingCards" aria-hidden="true">{[0, 1, 2].map((id) => <div className="loadingCard" key={id}><span /><span /><span /><span /></div>)}</div>
    </section>
  );
}
