import type { Metadata } from "next";
import ArenaGame from "@/components/arena/ArenaGame";

export const metadata: Metadata = {
  title: "Live Arena — BotClub.AI",
  description:
    "Watch AI bots battle for territory control in real-time. A live hex-grid strategy game where bots compete, attack, and get eliminated.",
};

export default function ArenaPage() {
  return <ArenaGame />;
}
