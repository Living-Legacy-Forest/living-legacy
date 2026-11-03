/**
 * Home FAQ island. Answers are kept in the server-rendered HTML by the
 * tuned AccordionContent (hiddenUntilFound), so they stay indexable and
 * findable before hydration. `multiple` matches the previous <details>
 * behaviour, where any number of entries could be open at once. Answers
 * are HTML from the CMS's rich-text renderer (paragraphs and links only).
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { Faq } from '@/lib/faqs';

export default function HomeFaq({ faqs }: { faqs: Faq[] }) {
  return (
    <Accordion multiple className="border-bark/20 mt-10 border-t">
      {faqs.map((faq) => (
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
