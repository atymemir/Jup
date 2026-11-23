import Link from "next/link";
import st from "./platform.module.css";
export function ProviderLanding({ business = false }: { business?: boolean }) {
  return (
    <main className={st.public}>
      <header className={st.publicHeader}>
        <Link href="/" className={st.brand}>
          findbuddy<span>.</span>
        </Link>
        <nav>
          <Link href={business ? "/teach" : "/for-centers"}>
            {business ? "Преподавателям" : "Учебным центрам"}
          </Link>
          <Link href={"/login?role=" + (business ? "business" : "teacher")}>
            Войти
          </Link>
        </nav>
      </header>
      <section className={st.hero}>
        <div>
          <p className={st.eyebrow}>
            {business ? "Для учебных центров" : "Для преподавателей"}
          </p>
          <h1>
            {business
              ? "Ваша команда. Одно расписание."
              : "Ваш опыт заслуживает своих учеников."}
          </h1>
          <p>
            {business
              ? "Соберите преподавателей в одном центре, публикуйте занятия и принимайте обращения учеников."
              : "Расскажите о подходе, добавьте направления и откройте удобное время. Материалы, переписка и работы останутся рядом с занятием."}
          </p>
          <div className={st.actions}>
            <Link
              className="primary"
              href={
                "/login?mode=signup&role=" + (business ? "business" : "teacher")
              }
            >
              {business
                ? "Зарегистрировать центр"
                : "Создать аккаунт преподавателя"}
            </Link>
            <Link className={st.textButton} href="/">
              Я ищу занятия
            </Link>
          </div>
          <p>Бесплатный пилот FindBuddy · комиссия платформы 0%</p>
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
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
