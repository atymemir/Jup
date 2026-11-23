import { useState } from "react";
import { lessonDate, money, type Tutor, type Group } from "../lib/findbuddy";
import { tutorPortrait } from "./TutorCard";
import { TutorPhoto } from "./TutorProfile";
import st from "./profile.module.css";

export function SavedComparison({
  tutors,
  local,
  available,
  profile,
  write,
}: {
  tutors: Tutor[];
  local: boolean;
  available: (id: string) => Group | undefined;
  profile: (id: string) => void;
  write: (id: string) => void;
}) {
  const [left, setLeft] = useState(tutors[0].id);
  const [right, setRight] = useState(tutors[1].id);
  const first = tutors.find((t) => t.id === left) ?? tutors[0];
  const second =
    tutors.find((t) => t.id === right && t.id !== first.id) ??
    tutors.find((t) => t.id !== first.id)!;
  return (
    <section className={st.comparison} aria-label="Сравнение преподавателей">
      <h3>Сравнить преподавателей</h3>
      <div className={st.comparisonGrid}>
        {[first, second].map((t, index) => {
          const next = available(t.id);
          return (
            <div key={index} className={st.comparisonCard}>
              <select
                aria-label={
                  index ? "Второй преподаватель" : "Первый преподаватель"
                }
                value={t.id}
                onChange={(e) =>
                  index ? setRight(e.target.value) : setLeft(e.target.value)
                }
              >
                {tutors
                  .filter(
                    (item) =>
                      item.id === (index ? second.id : first.id) ||
                      item.id !== (index ? first.id : second.id),
                  )
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.display_name}
                    </option>
                  ))}
              </select>
              <div className={st.comparePerson}>
                <TutorPhoto tutor={t} source={tutorPortrait(t, local)} />
                <div>
                  <strong>{t.display_name}</strong>
                  <p>
                    {t.subject} · {t.exam}
                  </p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Цена за 60 минут</dt>
                  <dd>{money(next?.price ?? t.price)}</dd>
                </div>
                <div>
                  <dt>Ближайшее время</dt>
                  <dd>
                    {next ? lessonDate(next.starts_at) : "По договорённости"}
                  </dd>
                </div>
                <div>
                  <dt>Формат и язык</dt>
                  <dd>
                    {t.city} · {t.language}
                  </dd>
                </div>
                <div>
                  <dt>Опыт</dt>
                  <dd>{t.experience} г.</dd>
                </div>
              </dl>
              <button className="primary" onClick={() => profile(t.id)}>
                Открыть анкету
              </button>
              <button className={st.link} onClick={() => write(t.id)}>
                Написать
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
