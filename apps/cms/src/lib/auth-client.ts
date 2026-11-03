import { inferAdditionalFields, magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    inferAdditionalFields({
      user: {
        bio: { type: 'string', required: false },
        imageAlt: { type: 'string', required: false },
      },
    }),
  ],
});
