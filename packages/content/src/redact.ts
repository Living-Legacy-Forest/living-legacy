// Masks email addresses in text bound for logs, which leave Australia (the
// CMS's logs go to Better Stack in the US). The first letter and the domain
// stay, so a log still says roughly whose booking or which provider it was.

const EMAIL = /([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;

/** "jo.tester@example.com" → "j***@example.com". */
export function maskEmails(text: string): string {
  return text.replace(EMAIL, '$1***@$2');
}
