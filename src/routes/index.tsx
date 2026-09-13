import { createFileRoute } from "@tanstack/react-router";
import { SynthApp } from "@/components/synth/SynthApp";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <SynthApp />;
}
