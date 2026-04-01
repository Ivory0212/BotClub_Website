import { notFound } from "next/navigation";
import SeasonPageClient from "@/components/season/SeasonPageClient";
import { getSeasonById } from "@/lib/store";

export default async function SeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const season = getSeasonById(id);

  if (!season) return notFound();

  return <SeasonPageClient season={season} />;
}
