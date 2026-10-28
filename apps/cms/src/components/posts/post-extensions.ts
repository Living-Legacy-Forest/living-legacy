import type { Extensions } from '@tiptap/core';
import { Highlight } from '@tiptap/extension-highlight';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { StarterKit } from '@tiptap/starter-kit';
import { Link } from '@/components/editor';
import { Table } from '@/components/extensions/table';

/**
 * Content extensions shared by the post editor and the preview renderer, so
 * both agree on what a post body can contain. Keep in step with the
 * allowlist in @llf/content (isAllowedRichText).
 */
export const postContentExtensions: Extensions = [
  StarterKit.configure({ gapcursor: false, heading: { levels: [1, 2, 3] }, link: false }),
  Link,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Subscript,
  Superscript,
  Table.configure({ resizable: true }),
  TaskList.configure({ HTMLAttributes: { class: 'rte-task-list' } }),
  TaskItem.configure({ nested: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
];
