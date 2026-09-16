/**
 * Single multiline capture field (SPEC.md §25B).
 * Phase 0 renders the field only; capture submission arrives with the capture pipeline.
 */
export function CaptureBox() {
  return (
    <div className="capture">
      <label htmlFor="capture" className="capture__label">
        What are you thinking?
      </label>
      <textarea id="capture" className="capture__input" placeholder="What are you thinking?" />
      <p className="capture__hint">Cmd/Ctrl + Enter to capture</p>
    </div>
  );
}
