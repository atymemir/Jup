import type { Booking, LessonOutcome } from "./findbuddy";

export function outcomeState(outcome?: LessonOutcome) {
  if (
    outcome?.teacher_response === "problem" ||
    outcome?.student_response === "problem"
  )
    return "problem";
  if (
    outcome?.teacher_response === "completed" &&
    outcome.student_response === "completed"
  )
    return "confirmed";
  return "pending";
}
export function outcomeLabel(outcome?: LessonOutcome) {
  const state = outcomeState(outcome);
  if (state === "problem") return "Есть вопрос по проведению";
  if (state === "confirmed") return "Проведение подтверждено";
  if (outcome?.teacher_response === "completed")
    return "Ждём подтверждения ученика";
  if (outcome?.student_response === "completed")
    return "Ждём подтверждения преподавателя";
  return "Подтвердите проведение";
}
export function commissionSummary(
  bookings: Booking[],
  outcomes: LessonOutcome[],
  tutor: string,
  now: number,
) {
  const byBooking = new Map(
    outcomes.map((outcome) => [outcome.booking_id, outcome]),
  );
  const rows = bookings
    .filter(
      (booking) =>
        booking.tutor_id === tutor &&
        booking.status !== "cancelled" &&
        Date.parse(booking.starts_at) + 3600000 <= now,
    )
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))
    .map((booking) => ({
      booking,
      outcome: byBooking.get(booking.id),
      state: outcomeState(byBooking.get(booking.id)),
    }));
  const confirmed = rows.filter((row) => row.state === "confirmed");
  return {
    rows,
    confirmed: confirmed.length,
    pending: rows.filter((row) => row.state === "pending").length,
    problems: rows.filter((row) => row.state === "problem").length,
    gross: confirmed.reduce((sum, row) => sum + row.booking.price, 0),
    commission: confirmed.reduce((sum, row) => sum + row.booking.commission, 0),
  };
}
