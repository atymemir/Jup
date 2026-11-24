import type { Account } from "./platform";
import type { IconName } from "../ui/Icon";

export type Notification = { id: number; kind: string; entity_id: string; context?: string; created_at: string; read_at: string | null };
export type NotificationList = { items: Notification[]; unread: number };
const content: Record<string, [string, string, string, IconName]> = {
 lesson_outcome: ["Участник подтвердил проведение урока", "Проверьте результат и оставьте свой ответ после окончания занятия.", "Открыть результат урока", "check"],
 lesson_problem: ["Участник сообщил о проблеме с уроком", "Посмотрите подробности в карточке занятия и обсудите решение.", "Разобраться с проблемой", "requests"],
 teacher_review: ["Новая анкета на проверку", "Преподаватель ожидает решения команды.", "Проверить анкету", "teacher"],
 organization_review: ["Учебный центр ожидает проверки", "Проверьте страницу и предоставленные сведения.", "Проверить центр", "teacher"],
 report_received: ["Новое обращение пользователя", "Посмотрите причину обращения и примите решение.", "Открыть обращения", "requests"],
 report_resolved: ["Ваше обращение рассмотрено", "Команда рассмотрела ваше обращение. Если проблема повторится, вы можете сообщить о ней снова.", "Открыть помощь", "check"],
 invitation_accepted: ["Ваше приглашение принято", "Новый участник присоединился к команде.", "Посмотреть команду", "groups"],
 move_declined: ["Перенос урока отклонён", "Занятие остаётся в прежнее время. При необходимости предложите другой вариант.", "Посмотреть время урока", "clock"],
 move_withdrawn: ["Предложение переноса отозвано", "Согласовывать перенос больше не нужно. Время урока не изменилось.", "Посмотреть время урока", "clock"],
 organization_message: ["Новое сообщение в чате центра", "Откройте переписку с учебным центром.", "Открыть чаты центра", "requests"],
 organization_approved: ["Учебный центр прошёл проверку", "Страница центра доступна ученикам.", "Открыть страницу центра", "check"],
 organization_rejected: ["Страница центра требует доработки", "Посмотрите комментарий модератора и внесите исправления.", "Исправить страницу", "teacher"],
 organization_pending: ["Центр отправлен на проверку", "Дождитесь результата проверки команды.", "Проверить статус", "teacher"],
 booking_confirmed: ["Запись на урок подтверждена", "Проверьте время и откройте детали занятия.", "Открыть занятие", "calendar"],
 booking_cancelled: ["Занятие отменено", "Посмотрите детали и договоритесь о новом времени.", "Посмотреть отмену", "calendar"],
 booking_moved: ["Время занятия изменилось", "Проверьте новую дату в карточке урока.", "Проверить время", "clock"],
 request_received: ["Вам пришла заявка на обучение", "Ученик рассказал о своей цели. Предложите подходящий урок.", "Ответить на заявку", "requests"],
 offer_received: ["Преподаватель предложил урок", "Посмотрите дату, стоимость и условия перед записью.", "Посмотреть предложение", "teacher"],
 offer_declined: ["Предложение урока отклонено", "Откройте заявки, чтобы проверить дальнейшие действия.", "Открыть заявки", "requests"],
 direct_message: ["Новое личное сообщение", "Вам написали в личном диалоге.", "Прочитать сообщение", "requests"],
 lesson_message: ["Новое сообщение по занятию", "Обсуждение урока ждёт вас в чате занятия.", "Открыть чат урока", "requests"],
 move_requested: ["Предложено другое время урока", "Перенос ещё не согласован. Подтвердите или отклоните предложение.", "Рассмотреть перенос", "clock"],
 profile_approved: ["Ваша анкета прошла проверку", "Теперь ученики могут найти вас в каталоге.", "Открыть анкету", "check"],
 profile_rejected: ["Анкета требует доработки", "Посмотрите комментарий модератора и исправьте анкету.", "Исправить анкету", "teacher"],
 profile_pending: ["Анкета отправлена на проверку", "Результат появится здесь после проверки командой.", "Проверить статус", "teacher"],
 homework_received: ["Ученик отправил домашнюю работу", "Проверьте ответ и оставьте обратную связь.", "Проверить работу", "teacher"],
 homework_feedback: ["Преподаватель проверил вашу работу", "Откройте комментарий и узнайте, что делать дальше.", "Прочитать отзыв", "check"],
 lesson_updated: ["Преподаватель обновил занятие", "Могли измениться материалы, домашняя работа или ссылка на встречу.", "Посмотреть обновления", "bookmark"],
 lesson_soon: ["Занятие в ближайшие 24 часа", "Уточните время и подготовьте материалы заранее.", "Подготовиться к уроку", "clock"],
};
export function notificationContent(item: Notification, role: Account["role"], home: string) {
 const [title, description, action, icon] = content[item.kind] ?? ["Обновление в вашем кабинете", "Посмотрите, что изменилось.", "Открыть кабинет", "calendar"];
 const valid = /^[a-f0-9-]{36}$/i.test(item.entity_id);
 let hash = "";
 if (item.kind === "report_resolved") return { title, description, action, icon, href: "/guide#questions" };
 if (item.kind === "teacher_review" || item.kind === "organization_review") hash = "queue";
 else if (item.kind === "report_received") hash = "reports";
 else if (item.kind === "invitation_accepted") hash = role === "business" ? "team" : "staff";
 else if (item.kind === "organization_message") hash = role === "business" ? "messages" : "centers";
 else if (item.kind.startsWith("organization_")) hash = "page";
 else if (valid && item.kind === "direct_message") hash = `messages/thread/${item.entity_id}`;
 else if (["request_received", "offer_received", "offer_declined"].includes(item.kind)) hash = "requests";
 else if (item.kind.startsWith("profile_")) hash = "profile";
 else if (valid && item.kind === "lesson_message") hash = `account/chat/${item.entity_id}`;
 else if (valid && ["homework_received", "homework_feedback", "lesson_updated"].includes(item.kind)) hash = `account/work/${item.entity_id}`;
 else if (valid && content[item.kind]) hash = `account/lesson/${item.entity_id}`;
 return { title, description, action, icon, href: home.replace(/^\/findbuddy/, "") + (hash ? "#" + hash : "") };
}
