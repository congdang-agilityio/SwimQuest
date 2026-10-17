import { LoadingState } from "@/components/states/loading-state";

/** Streamed while the page loads. Only on routes that never call notFound(), so 404s stay 404. */
export default function Loading() {
  return (
    <main>
      <LoadingState />
    </main>
  );
}
