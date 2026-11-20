import { describe, expect, it } from 'vitest';
import { applySuggestion } from './apply-suggestion';

describe('applySuggestion', () => {
  it('applies the suggestion when the field is as it was when the request started', () => {
    expect(applySuggestion({ before: 'Old', current: 'Old', suggestion: 'New' })).toBe('New');
  });

  it('does not overwrite what the editor typed while the suggestion was on its way', () => {
    expect(
      applySuggestion({ before: 'Old', current: 'Old, edited', suggestion: 'New' })
    ).toBeNull();
  });

  it('applies to a field that was empty and still is', () => {
    expect(applySuggestion({ before: '', current: '', suggestion: 'New' })).toBe('New');
  });
});
