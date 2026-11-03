/**
 * One FAQ group's questions as a shadcn Accordion. Every question in the
 * group opens and closes independently (not an exclusive single-open
 * accordion), matching the old <details>/<summary> markup this replaces,
 * with the first question open by default. Answers stay in the
 * server-rendered HTML via AccordionContent's hiddenUntilFound default, so
 * they remain indexable and findable with the browser's find-in-page before
 * this island ever hydrates.
 *
 * Answers are HTML rendered from the CMS by the shared rich-text renderer
 * (paragraphs and links only), so they are safe to set as HTML.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { FaqGroup } from '@/lib/faqs';

export function FaqAccordion({ group }: { group: FaqGroup }) {
  return (
    <Accordion multiple defaultValue={[group.faqs[0]?.id ?? '']}>
      {group.faqs.map((faq) => (
        <AccordionItem key={faq.id} value={faq.id}>
          <AccordionTrigger>{faq.question}</AccordionTrigger>
          <AccordionContent>
            <div dangerouslySetInnerHTML={{ __html: faq.answerHtml }} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
