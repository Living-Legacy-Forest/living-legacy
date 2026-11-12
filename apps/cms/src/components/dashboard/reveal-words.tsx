import { type CSSProperties, Fragment } from 'react';

/**
 * Text whose words arrive one after another (the reveal-word rules in styles.css).
 * Real spaces sit between the words, so the text reads and copies as one line.
 */
export function RevealWords({ text }: { text: string }) {
  return text.split(' ').map((word, i) => (
    // The words never reorder, so their position is a stable key.
    <Fragment key={i}>
      {i > 0 && ' '}
      <span data-slot="reveal-word" style={{ '--word': i } as CSSProperties}>
        {word}
      </span>
    </Fragment>
  ));
}
