import { LoadingState } from "@/components/states/loading-state";

/** Streamed while My Profile loads its stats and badges. */
export default function Loading() {
  return (
    <main>
      <LoadingState />
    </main>
  );
}
