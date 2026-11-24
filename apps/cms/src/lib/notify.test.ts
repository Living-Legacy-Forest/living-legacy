import { describe, expect, it, vi } from 'vitest';
import { deletedNotice, removedNotice, restoredNotice } from './notify';

const NOUN = ['team member', 'team members'] as const;

describe('the delete toasts', () => {
  it('say "deleted", the word on the Delete button', () => {
    expect(removedNotice(1, NOUN).title).toBe('Team member deleted');
    expect(deletedNotice(3, NOUN, () => {}).title).toBe('3 team members deleted');
  });

  it('offer Undo when the list keeps a trash', () => {
    const undo = vi.fn();
    const notice = deletedNotice(1, NOUN, undo);
    expect(notice.description).toBe('It is off the website.');
    expect(notice.action?.label).toBe('Undo');
    notice.action?.onClick();
    expect(undo).toHaveBeenCalledOnce();
  });

  it('say what came back after Undo', () => {
    expect(restoredNotice(1, NOUN).title).toBe('Team member restored');
    expect(restoredNotice(2, NOUN).title).toBe('2 team members restored');
  });
});
