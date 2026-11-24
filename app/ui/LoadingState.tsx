"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

export function LoadingState({
  label = "Готовим всё для учёбы…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const { t: tr } = useJupLocale();

  return compact ? (
    <span className="loadingInline" role="status">
      <span className="loadingOrbit" aria-hidden="true" />
      {tr(label)}
    </span>
  ) : (
    <section className="loadingState" aria-busy="true" aria-label={tr(label)}>
      <div className="loadingIdentity">
        <span className="loadingOrbit" aria-hidden="true" />
        <p role="status">{tr(label)}</p>
        <span className="loadingTrack" aria-hidden="true" />
      </div>
      <div className="loadingCards" aria-hidden="true">
        {[0, 1, 2].map((id) => (
          <div className="loadingCard" key={id}>
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </section>
  );
}
