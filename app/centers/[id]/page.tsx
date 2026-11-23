import { Centers } from "../../platform/Centers";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Centers id={id} />;
}
