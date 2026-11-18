// A video in a post body or an event description. Stored as a provider and an id only
// (see video-embed in @ll/content); the player address is built from them here and on the
// website, so a document never carries an arbitrary iframe.
import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { VIDEO_PROVIDER_LABEL, isVideoRef, videoEmbedSrc, type VideoRef } from '@ll/content';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    videoEmbed: {
      setVideoEmbed: (video: VideoRef & { title?: string | null }) => ReturnType;
    };
  }
}

const IFRAME_ALLOW = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen';

function VideoEmbedView({ node, selected, editor, updateAttributes }: NodeViewProps) {
  const { provider, id, title } = node.attrs as VideoRef & { title: string | null };
  const editing = selected && editor.isEditable;
  const valid = isVideoRef({ provider, id });
  const label = valid ? `${VIDEO_PROVIDER_LABEL[provider]} video${title ? `: ${title}` : ''}` : '';

  return (
    <NodeViewWrapper as="figure" className="my-6" data-drag-handle>
      <div
        className={cn(
          'bg-muted relative aspect-video w-full overflow-hidden rounded-md',
          editing && 'ring-ring ring-2 ring-offset-2'
        )}
      >
        {valid ? (
          <iframe
            src={videoEmbedSrc({ provider, id })}
            title={label}
            loading="lazy"
            allow={IFRAME_ALLOW}
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            // While editing, the first click should select the block, not start the video.
            className={cn(
              'absolute inset-0 size-full border-0',
              editor.isEditable && !selected && 'pointer-events-none'
            )}
          />
        ) : (
          <p className="text-muted-foreground grid h-full place-items-center text-sm">
            This video link is not supported.
          </p>
        )}
      </div>
      {editing ? (
        <div contentEditable={false} className="mt-3">
          <Input
            aria-label="Caption"
            maxLength={300}
            value={title ?? ''}
            onChange={(e) => updateAttributes({ title: e.target.value || null })}
            placeholder="Caption (optional)"
            className="text-ui"
          />
        </div>
      ) : title ? (
        <figcaption className="text-muted-foreground mt-2 text-center text-sm">{title}</figcaption>
      ) : null}
    </NodeViewWrapper>
  );
}

export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      provider: { default: 'youtube' },
      id: { default: '' },
      title: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-video-provider]',
        getAttrs: (el) => ({
          provider: (el as HTMLElement).dataset.videoProvider,
          id: (el as HTMLElement).dataset.videoId,
          title: (el as HTMLElement).querySelector('figcaption')?.textContent || null,
        }),
      },
    ];
  },

  // What the preview renders and what copy and paste carries. Nothing from `attrs` becomes an
  // address unless it passes isVideoRef.
  renderHTML({ node }) {
    const { provider, id, title } = node.attrs as VideoRef & { title: string | null };
    if (!isVideoRef({ provider, id })) return ['figure', { class: 'video-embed' }];
    return [
      'figure',
      mergeAttributes({
        class: 'video-embed',
        'data-video-provider': provider,
        'data-video-id': id,
      }),
      [
        'div',
        { class: 'video-embed-frame' },
        [
          'iframe',
          {
            src: videoEmbedSrc({ provider, id }),
            title: `${VIDEO_PROVIDER_LABEL[provider]} video${title ? `: ${title}` : ''}`,
            loading: 'lazy',
            allow: IFRAME_ALLOW,
            allowfullscreen: 'true',
          },
        ],
      ],
      ...(title ? [['figcaption', {}, title]] : []),
    ];
  },

  addCommands() {
    return {
      setVideoEmbed:
        (video) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: video }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedView);
  },
});
