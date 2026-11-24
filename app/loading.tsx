import { LoadingState } from "./ui/LoadingState";
export default function Loading() {
  return (
    <main className="routeLoading">
      <LoadingState compact />
    </main>
  );
}
