/**
 * One FAQ group's questions as a shadcn Accordion. Every question in the
 * group opens and closes independently (not an exclusive single-open
 * accordion), matching the old <details>/<summary> markup this replaces,
 * with the first question open by default. Answers stay in the
 * server-rendered HTML via AccordionContent's hiddenUntilFound default, so
 * they remain indexable and findable with the browser's find-in-page before
 * this island ever hydrates.
 *
 * Each answer is one or more paragraphs of trusted, static HTML authored in
 * faqs.astro (a handful carry an inline link to a sister site's own booking
 * form), rendered here the same way Astro's set:html does.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface FaqItem {
  q: string;
  a: string[];
}

export interface FaqGroup {
  id: string;
  heading: string;
  items: FaqItem[];
}

export function FaqAccordion({ group }: { group: FaqGroup }) {
  return (
    <Accordion multiple defaultValue={[`${group.id}-0`]}>
      {group.items.map((item, i) => (
        <AccordionItem key={item.q} value={`${group.id}-${i}`}>
          <AccordionTrigger>{item.q}</AccordionTrigger>
          <AccordionContent>
            {item.a.map((paragraph, pi) => (
              // Trusted, page-authored HTML (inline links); see faqs.astro.
              <p key={pi} dangerouslySetInnerHTML={{ __html: paragraph }} />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
