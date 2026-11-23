// In-memory hand-off from the scanner to the product form (photo blob + detected code + embedding)
let draft = null;
export function setDraft(d) {
  draft = d;
}
export function takeDraft() {
  const d = draft;
  draft = null;
  return d;
}
