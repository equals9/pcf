/** Weekday, month, day of the current local date (SPEC.md §25A). No statistics. */
export function DateHeader() {
  const now = new Date();
  const label = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <header className="today__header">
      <h1 className="today__date">
        <time dateTime={now.toISOString().slice(0, 10)}>{label}</time>
      </h1>
    </header>
  );
}
