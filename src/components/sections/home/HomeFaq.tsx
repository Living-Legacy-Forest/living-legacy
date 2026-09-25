/**
 * Home FAQ island. Answers are kept in the server-rendered HTML by the
 * tuned AccordionContent (hiddenUntilFound), so they stay indexable and
 * findable before hydration. `multiple` matches the previous <details>
 * behaviour, where any number of entries could be open at once.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FaqEntry {
  question: string;
  answer: string;
}

export default function HomeFaq({ faqs }: { faqs: readonly FaqEntry[] }) {
  return (
    <Accordion multiple className="border-bark/20 mt-10 border-t">
      {faqs.map((faq, i) => (
        <AccordionItem key={faq.question} value={`home-faq-${i}`}>
          <AccordionTrigger>{faq.question}</AccordionTrigger>
          <AccordionContent>{faq.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
