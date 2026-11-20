/**
 * Whether a list page's pager should be tucked away: only at the very top of a list that scrolls.
 *
 * Hiding the pager gives the list its height, so the list must still scroll after that, or there
 * would be no way to scroll down and bring the pager back (and the other pages would be out of
 * reach). So the test is against the height the list would have without the pager.
 */
export function shouldHidePager({
  scrollTop,
  scrollHeight,
  clientHeight,
  pagerHeight,
  hidden,
}: {
  scrollTop: number;
  scrollHeight: number;
  /** The list's height as it is now. */
  clientHeight: number;
  /** The pager's height when it shows. */
  pagerHeight: number;
  /** Whether the pager is hidden now, which is when `clientHeight` already has its room. */
  hidden: boolean;
}) {
  const heightWithoutPager = hidden ? clientHeight : clientHeight + pagerHeight;
  return scrollTop <= 0 && scrollHeight > heightWithoutPager + 1;
}
