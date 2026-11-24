"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";
import { useMemo } from "react";
import { commissionSummary, outcomeLabel } from "../lib/outcomes";
import { lessonDate, money, type Dashboard } from "../lib/findbuddy";
import st from "./teacher.module.css";

export function CommissionSummary({
  dashboard,
  user,
  now,
  open,
}: {
  dashboard: Dashboard;
  user: string;
  now: number;
  open: (id: string) => void;
}) {
  const { t: tr, locale: uiLocale } = useJupLocale();

  const summary = useMemo(
    () =>
      commissionSummary(
        dashboard.bookings,
        dashboard.outcomes ?? [],
        user,
        now,
      ),
    [dashboard.bookings, dashboard.outcomes, user, now],
  );
  return (
    <section className={st.settlements} aria-label={tr("Расчёты в пилоте")}>
      <div>
        <h1>{tr("Расчёты в пилоте")}</h1>
        <p>
          {tr(
            "Jup edu в пилоте бесплатен для преподавателей. В итог стоимости включены только записи, проведение которых подтвердили вы и ученик.",
          )}
        </p>
      </div>
      <dl className={st.settlementTotals}>
        <div>
          <dt>{tr("Подтверждено записей")}</dt>
          <dd>{summary.confirmed}</dd>
        </div>
        <div>
          <dt>{tr("Стоимость этих занятий")}</dt>
          <dd>{tr(money(summary.gross, uiLocale))}</dd>
        </div>
        <div>
          <dt>{tr("Комиссия Jup edu · 0%")}</dt>
          <dd>{tr(money(summary.commission, uiLocale))}</dd>
        </div>
      </dl>
      <p className={st.settlementNote}>
        {tr(
          "Планируемый тариф после пилота — 5%, сейчас он не действует. Пилотные записи останутся без комиссии. Подтверждение проведения не подтверждает получение оплаты за урок.",
        )}
      </p>
      {summary.rows.length ? (
        <>
          <p>
            {summary.pending}
            {tr(" ждут подтверждения · ")}
            {summary.problems}
            {tr(
              " с вопросом по проведению. Участники мини-группы учитываются отдельно.",
            )}
          </p>
          <div className={st.settlementTable}>
            <table>
              <caption>
                {tr("Прошедшие записи · время Казахстана, UTC+5")}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{tr("Занятие")}</th>
                  <th scope="col">{tr("Проведение")}</th>
                  <th scope="col">{tr("Стоимость")}</th>
                  <th scope="col">{tr("Комиссия")}</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map(({ booking, outcome, state }) => (
                  <tr key={booking.id}>
                    <th scope="row">
                      <button onClick={() => open(booking.id)}>
                        {booking.lesson_title || booking.subject}
                      </button>
                      <small>
                        {tr(
                          dashboard.seats?.find((s) => s.id === booking.id)
                            ?.name ?? tr("Ученик"),
                        )}
                        {tr(" ")}· {tr(lessonDate(booking.starts_at, uiLocale))}
                      </small>
                    </th>
                    <td>{tr(outcomeLabel(outcome))}</td>
                    <td>{tr(money(booking.price, uiLocale))}</td>
                    <td>
                      {tr(
                        state === "confirmed"
                          ? money(booking.commission, uiLocale)
                          : tr("Не включено"),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>
          {tr(
            "После первого занятия подтвердите его проведение в комнате. Здесь появится история расчёта.",
          )}
        </p>
      )}
    </section>
  );
}
