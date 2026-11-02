/**
 * The topic dropdown on the blog index. Picking a topic loads its results
 * straight away, keeping whatever is typed in the search box. The form's
 * hidden `tag` field (BlogFilters.astro) carries the topic when the Search
 * button is pressed instead.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Topic {
  slug: string;
  title: string;
  count: number;
}

// Base UI treats an empty value as "nothing chosen", so "All topics" needs one.
const ALL = 'all';

export function BlogTopicSelect({ topics, tag }: { topics: Topic[]; tag: string }) {
  const items = [
    { value: ALL, label: 'All topics' },
    ...topics.map((t) => ({ value: t.slug, label: t.title })),
  ];

  function choose(value: string | null) {
    const search = new URLSearchParams();
    const q = document.querySelector<HTMLInputElement>('#blog-search')?.value.trim();
    if (q) search.set('q', q);
    if (value && value !== ALL) search.set('tag', value);
    const query = search.toString();
    window.location.assign(query ? `/blog/?${query}` : '/blog/');
  }

  return (
    <Select items={items} defaultValue={tag || ALL} onValueChange={choose}>
      <SelectTrigger
        aria-label="Topic"
        className="border-bark/25 h-12 w-full min-w-0 rounded-xl sm:w-80"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item, i) => (
          <SelectItem key={item.value} value={item.value}>
            <span className="flex-1">{item.label}</span>
            {i > 0 && (
              <span className="text-bark ml-3 text-sm tabular-nums">{topics[i - 1]?.count}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
