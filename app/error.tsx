"use client";
import { Brand } from "./ui/Brand";

import Link from "next/link";
export default function ErrorPage({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <main className="auth authCard"><Link className="authBrand" href="/"><Brand /></Link><h1>Не получилось открыть страницу</h1><p>Попробуйте ещё раз. Перед повторной записью проверьте «Мои занятия» — действие могло сохраниться.</p><button className="primary" onClick={() => unstable_retry()}>Повторить загрузку</button><div className="authFoot"><Link href="/student">Мои занятия</Link><Link href="/guide#questions">Помощь</Link></div></main>;
}
