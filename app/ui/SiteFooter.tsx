import Link from "next/link";
export function SiteFooter() {
  return <footer className="siteFooter">
    <div><Link className="footerBrand" href="/">findbuddy.</Link><p>Найди своего человека для учёбы.</p><small>Казахстан · ₸ · UTC+5</small></div>
    <nav aria-label="О сервисе"><span>Разобраться</span><Link href="/landing">О findbuddy</Link><Link href="/guide">Как пользоваться</Link><Link href="/guide#questions">Вопросы и ответы</Link><a href="https://www.instagram.com/fin.dbuddy/" target="_blank" rel="noopener noreferrer">Instagram ↗</a></nav>
    <nav aria-label="Партнёрам"><span>Развиваться вместе</span><Link href="/teach">Преподавателям</Link><Link href="/for-centers">Учебным центрам</Link><a href="mailto:dpsg2e@gmail.com">Связаться с командой</a></nav>
    <div className="footerLegal"><span>findbuddy · Учёба начинается с контакта.</span><Link href="/privacy">Конфиденциальность</Link><Link href="/terms">Правила сервиса</Link></div>
  </footer>;
}
