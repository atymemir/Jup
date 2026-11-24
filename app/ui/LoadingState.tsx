"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

export function LoadingState({
  label = "Загружаем…",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const { t: tr } = useJupLocale();

  const indicator = (
    <span className="loadingInline" role="status">
      <span className="loadingOrbit" aria-hidden="true" />
      <span>{tr(label)}</span>
    </span>
  );
  return compact ? (
    indicator
  ) : (
    <div className="loadingState" aria-busy="true">
      {indicator}
    </div>
  );
}
