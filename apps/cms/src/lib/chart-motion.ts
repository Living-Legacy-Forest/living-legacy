/**
 * How charts draw in when they first appear, and ease to new figures after a refresh.
 * 'auto' leaves them still for anyone who asks for reduced motion.
 * An ease-out, so the shape arrives quickly and settles, slow enough to see it draw.
 */
export const chartReveal = {
  isAnimationActive: 'auto',
  animationDuration: 800,
  animationEasing: 'cubic-bezier(0.33,1,0.68,1)',
} as const;
