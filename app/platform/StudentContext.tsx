"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { stageLabels, type StudentProfile } from "../lib/platform";
export function StudentContext({ id }: { id: string }) {
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
      <summary>Учебная цель ученика</summary>
      <p>
        {profile.name} · {stageLabels[profile.stage]}
        {profile.study_year ? " · " + profile.study_year + " класс/курс" : ""}
      </p>
      <p>{profile.goal}</p>
    </details>
  ) : null;
}
