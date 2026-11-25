"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { stageLabels, type StudentProfile } from "../lib/platform";
import { LoadingState } from "../ui/LoadingState";
export function StudentContext({ id }: { id: string }) {
  const { t: tr } = useJupLocale();

  const [state, setState] = useState<{
    id: string;
    profile: StudentProfile | null;
    error?: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    void api<StudentProfile | null>("student/" + id)
      .then((p) => {
        if (live) setState({ id, profile: p });
      })
      .catch(() => {
        if (live) setState({ id, profile: null, error: true });
      });
    return () => {
      live = false;
    };
  }, [id, attempt]);
  if (state?.id !== id) return <LoadingState compact />;
  if (state.error)
    return (
      <div role="alert">
        <p>{tr("Не удалось загрузить цель ученика.")}</p>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setState(null);
            setAttempt((value) => value + 1);
          }}
        >
          {tr("Повторить")}
        </button>
      </div>
    );
  const profile = state.profile;
  return profile ? (
    <details>
      <summary>{tr("Учебная цель ученика")}</summary>
      <p>
        {profile.name} · {tr(stageLabels[profile.stage])}
        {tr(
          profile.study_year
            ? " · " + profile.study_year + tr(" класс/курс")
            : "",
        )}
      </p>
      <p>{profile.goal}</p>
    </details>
  ) : null;
}
