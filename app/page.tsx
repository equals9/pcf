import { FOCUS_PARAM, TodayView } from "@/components/today/TodayView";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const focus = (await searchParams)[FOCUS_PARAM];
  return <TodayView focusId={typeof focus === "string" ? focus : undefined} />;
}
