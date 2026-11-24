"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { stageLabels, type StudentProfile } from "../lib/platform";
export function StudentContext({ id }: { id: string }) {
  const { t: tr } = useJupLocale();

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  useEffect(() => {
    let live = true;
    void api<StudentProfile | null>("student/" + id)
      .then((p) => {
        if (live) setProfile(p);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
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
