import { notFound } from "next/navigation";
import RoundPageClient from "@/components/round/RoundPageClient";
import { getRoundById } from "@/lib/store";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = getRoundById(id);

  if (!result) return notFound();

  const { season, round } = result;

  return <RoundPageClient season={season} round={round} />;
}
