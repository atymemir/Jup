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
    <section className={st.settlements} aria-label="Расчёты в пилоте">
      <div>
        <h1>Расчёты в пилоте</h1>
        <p>
          FindBuddy в пилоте бесплатен для преподавателей. В итог стоимости
          включены только записи, проведение которых подтвердили вы и ученик.
        </p>
      </div>
      <dl className={st.settlementTotals}>
        <div>
          <dt>Подтверждено записей</dt>
          <dd>{summary.confirmed}</dd>
        </div>
        <div>
          <dt>Стоимость этих занятий</dt>
          <dd>{money(summary.gross)}</dd>
        </div>
        <div>
          <dt>Комиссия FindBuddy · 0%</dt>
          <dd>{money(summary.commission)}</dd>
        </div>
      </dl>
      <p className={st.settlementNote}>
        Планируемый тариф после пилота — 5%, сейчас он не действует. Пилотные
        записи останутся без комиссии. Подтверждение проведения не подтверждает
        получение оплаты за урок.
      </p>
      {summary.rows.length ? (
        <>
          <p>
            {summary.pending} ждут подтверждения · {summary.problems} с вопросом
            по проведению. Участники мини-группы учитываются отдельно.
          </p>
          <div className={st.settlementTable}>
            <table>
              <caption>Прошедшие записи · время Казахстана, UTC+5</caption>
              <thead>
                <tr>
                  <th scope="col">Занятие</th>
                  <th scope="col">Проведение</th>
                  <th scope="col">Стоимость</th>
                  <th scope="col">Комиссия</th>
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
                        {dashboard.seats?.find((s) => s.id === booking.id)
                          ?.name ?? "Ученик"}{" "}
                        · {lessonDate(booking.starts_at)}
                      </small>
                    </th>
                    <td>{outcomeLabel(outcome)}</td>
                    <td>{money(booking.price)}</td>
                    <td>
                      {state === "confirmed"
                        ? money(booking.commission)
                        : "Не включено"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>
          После первого занятия подтвердите его проведение в комнате. Здесь
          появится история расчёта.
        </p>
      )}
    </section>
  );
}
