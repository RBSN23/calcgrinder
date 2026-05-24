// PROJ-16 — Image-hint detection regex.
//
// Detects whether the source body contains at least one Markdown image
// pattern `![…](http…)`. Used by the Builder's TextBlockEditorPane to
// surface a persistent "Hosted externally — may break if the source
// moves." hint below the source textarea.
//
// Runs on local body state (not on persisted body), so the hint appears
// in the same render pass as the keystroke that introduced the image.

const IMAGE_REGEX = /!\[[^\]]*\]\(\s*https?:\/\//i;

export function hasExternalImageSyntax(body: string): boolean {
  return IMAGE_REGEX.test(body);
}
