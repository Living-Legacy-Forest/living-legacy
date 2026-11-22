# Backups and restore (CMS)

What protects the content, how to get it back, and the drill that proves it works. The website has
no data of its own: it reads the CMS's database and media.

| What                                | Protection                                | How far back              |
| ----------------------------------- | ----------------------------------------- | ------------------------- |
| Database (`living-legacy-db`, D1)   | Cloudflare D1 Time Travel, always on      | 7 days Free, 30 days Paid |
| Media files (`living-legacy-media`) | The CMS's media trash                     | 30 days from deleting     |
| Posts, legal pages                  | Revisions in the CMS, and the posts trash | As long as they are kept  |

Nothing is copied off Cloudflare. Losing the account, or a bucket emptied outside the CMS, is not
covered.

## Check the database's retention

Time Travel keeps 30 days on the Workers Paid plan and 7 on Free. Check which plan the account is
on in the Cloudflare dashboard (Workers & Pages > Plans). On Free, a mistake noticed after a week
cannot be undone.

## Restore the database

A restore is in place: the whole database goes back to the chosen moment, and everything written
since is lost, including bookings, edits and sign-ins. Restore only for a real loss, and tell the
team first. From `apps/cms`, with a Cloudflare API token that can edit D1:

```sh
# The restore point for a moment (UTC), and the bookmark for now, to undo the restore if needed.
bunx wrangler d1 time-travel info living-legacy-db --timestamp=2026-11-20T03:00:00Z
bunx wrangler d1 time-travel info living-legacy-db          # note this bookmark first

bunx wrangler d1 time-travel restore living-legacy-db --timestamp=2026-11-20T03:00:00Z
# Changed your mind? Restore to the bookmark noted above:
bunx wrangler d1 time-travel restore living-legacy-db --bookmark=<bookmark>
```

The website shows the restored content at once; its page cache follows the database's content
version.

### Media after a database restore

Files live in R2, not the database, so a restore only brings back rows. A file deleted permanently
(Delete permanently in the trash, or 30 days after it went there) is gone: a restored row for it
shows a broken image. A file still in the trash is fine: restore it in Media.

## Restore media

Media > Trash lists every file deleted in the last 30 days. Restore puts a file back in the library
and on the website wherever it was used. Deleting from the trash is final.

## Restore drill (every quarter)

The drill exercises the restore command on a scratch database, so production is never touched.
The export holds people's names, emails and phone numbers: keep it on your machine, never commit
or share it, and delete it when done. From `apps/cms`:

```sh
bunx wrangler d1 export living-legacy-db --remote --output=/tmp/drill.sql
bunx wrangler d1 create living-legacy-drill
bunx wrangler d1 execute living-legacy-drill --remote --file=/tmp/drill.sql

# Note the time, make a change, restore to before it, and check it is gone.
date -u +%Y-%m-%dT%H:%M:%SZ
bunx wrangler d1 execute living-legacy-drill --remote --command="DELETE FROM faqs"
bunx wrangler d1 time-travel restore living-legacy-drill --timestamp=<the time noted>
bunx wrangler d1 execute living-legacy-drill --remote --command="SELECT COUNT(*) FROM faqs"

bunx wrangler d1 delete living-legacy-drill
rm /tmp/drill.sql
```

Write the date and the result in the team's notes. If any step fails, fix this page before the
next drill.
