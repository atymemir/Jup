"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";
import { Brand } from "../ui/Brand";
import Link from "next/link";
import { LanguageSwitcher } from "../i18n/LocaleProvider";
import st from "./platform.module.css";
export function ProviderLanding({ business = false }: { business?: boolean }) {
  const { t: tr } = useJupLocale();

  return (
    <main className={st.public}>
      <header className={st.publicHeader}>
        <Link href="/" className={st.brand}>
          <Brand />
        </Link>
        <LanguageSwitcher />
        <nav>
          <Link href={business ? "/teach" : "/for-centers"}>
            {tr(business ? tr("Преподавателям") : tr("Учебным центрам"))}
          </Link>
          <Link href={"/login?role=" + (business ? "business" : "teacher")}>
            {tr("Войти")}
          </Link>
        </nav>
      </header>
      <section className={st.hero}>
        <div>
          <p className={st.eyebrow}>
            {tr(
              business ? tr("Для учебных центров") : tr("Для преподавателей"),
            )}
          </p>
          <h1>
            {tr(
              business
                ? tr("Ваша команда. Одно расписание.")
                : tr("Ваш опыт заслуживает своих учеников."),
            )}
          </h1>
          <p>
            {tr(
              business
                ? tr(
                    "Соберите преподавателей в одном центре, публикуйте занятия и принимайте обращения учеников.",
                  )
                : tr(
                    "Расскажите о подходе, добавьте направления и откройте удобное время. Материалы, переписка и работы останутся рядом с занятием.",
                  ),
            )}
          </p>
          <div className={st.actions}>
            <Link
              className="primary"
              href={
                "/login?mode=signup&role=" + (business ? "business" : "teacher")
              }
            >
              {tr(
                business
                  ? tr("Зарегистрировать центр")
                  : tr("Создать аккаунт преподавателя"),
              )}
            </Link>
            <Link className={st.textButton} href="/">
              {tr("Я ищу занятия")}
            </Link>
          </div>
          <p>{tr("Бесплатный пилот Jup edu · комиссия платформы 0%")}</p>
        </div>
        <div className={st.stack}>
          {(business
            ? [
                [
                  "Команда с личными аккаунтами",
                  "Приглашайте преподавателей. Каждый самостоятельно принимает приглашение.",
                ],
                [
                  "Проверенная страница центра",
                  "Публикация открывается после ручной проверки контактов и данных.",
                ],
                [
                  "Общее расписание",
                  "Занятость преподавателей проверяется и между центрами.",
                ],
              ]
            : [
                [
                  "Полноценная анкета",
                  "Образование, сертификаты, языки и ваш подход к обучению.",
                ],
                [
                  "Несколько направлений",
                  "Для каждого предмета и экзамена — свои условия занятий.",
                ],
                [
                  "Уроки на ваших условиях",
                  "Индивидуально или в группе. При желании конкретный урок можно провести бесплатно.",
                ],
              ]
          ).map(([title, text]) => (
            <article className={st.tile} key={title}>
              <h2>{tr(title)}</h2>
              <p>{tr(text)}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
