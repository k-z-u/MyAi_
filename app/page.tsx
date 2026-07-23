import type { Metadata } from "next";
import MyAiApp from "./MyAiApp";

export const metadata: Metadata = {
  title: "MyAi — Today execution system",
  description: "Treat yourself as an AI agent and process today’s work queue.",
};

export default function Home() {
  return <MyAiApp />;
}
