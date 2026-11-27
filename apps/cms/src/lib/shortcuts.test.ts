import { describe, expect, it } from 'vitest';
import { isTypingElement } from './shortcuts';

describe('isTypingElement', () => {
  it('treats text fields as typing, whatever the case of the tag', () => {
    for (const tagName of ['INPUT', 'textarea', 'Select']) {
      expect(isTypingElement({ tagName })).toBe(true);
    }
  });

  it('treats the rich-text editor as typing', () => {
    expect(isTypingElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('treats something inside an editor, textbox or combobox as typing', () => {
    const inside = { tagName: 'SPAN', closest: () => ({}) };
    expect(isTypingElement(inside)).toBe(true);
  });

  it('leaves buttons, rows and the page alone', () => {
    expect(isTypingElement({ tagName: 'BUTTON', closest: () => null })).toBe(false);
    expect(isTypingElement({ tagName: 'DIV' })).toBe(false);
    expect(isTypingElement(null)).toBe(false);
    expect(isTypingElement(undefined)).toBe(false);
  });
});
