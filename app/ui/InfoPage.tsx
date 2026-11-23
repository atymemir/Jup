import Link from "next/link";
import { SiteFooter } from "./SiteFooter";
export function InfoPage({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <main className="infoPage"><header><Link className="footerBrand" href="/">findbuddy.</Link><Link href="/">Найти преподавателя ↗</Link></header><article><p className="infoEyebrow">Помощь и документы</p><h1>{title}</h1><p className="infoIntro">{intro}</p>{children}</article><SiteFooter /></main>;
}
