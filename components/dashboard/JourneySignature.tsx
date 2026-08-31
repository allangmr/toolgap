import { SequenceChips } from "@/components/viz/SequenceChips";

export function JourneySignature({ signature }: { signature: string }) {
  return <SequenceChips signature={signature} />;
}
