import { describe, expect, it } from 'vitest';

import { hasExternalImageSyntax } from './image-hint';

describe('hasExternalImageSyntax', () => {
  it('detects a single https image', () => {
    expect(
      hasExternalImageSyntax('Here is ![Alt](https://example.com/x.png) inline.'),
    ).toBe(true);
  });

  it('detects an http image (also surfaces the hint)', () => {
    expect(hasExternalImageSyntax('![logo](http://example.com/l.png)')).toBe(true);
  });

  it('detects when alt text is empty', () => {
    expect(hasExternalImageSyntax('![](https://example.com/x.png)')).toBe(true);
  });

  it('tolerates whitespace after the opening paren', () => {
    expect(hasExternalImageSyntax('![alt](  https://example.com/x.png)')).toBe(true);
  });

  it('returns false on plain prose with no image syntax', () => {
    expect(hasExternalImageSyntax('Just some markdown **bold** prose.')).toBe(false);
  });

  it('returns false on a markdown link (not an image)', () => {
    expect(hasExternalImageSyntax('[text](https://example.com)')).toBe(false);
  });

  it('returns false on a data: URI (data: images are sanitized out anyway)', () => {
    expect(
      hasExternalImageSyntax('![bad](data:image/png;base64,AAAA)'),
    ).toBe(false);
  });

  it('returns false on an empty body', () => {
    expect(hasExternalImageSyntax('')).toBe(false);
  });

  it('returns true when at least one image is present even alongside other content', () => {
    const body =
      '# Header\n\nSome prose.\n\n![](https://cdn.example.com/img.png)\n\nMore prose.';
    expect(hasExternalImageSyntax(body)).toBe(true);
  });
});
