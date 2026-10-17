/** Whether a review should wait for a person before it is published.
 *
 * Most reviews go live at once. One carrying a phone number or a link is the
 * shape spam and scams take ("WhatsApp 017… for cheaper"), and one with abuse
 * in it is not something the shop wants under a product, so those are held
 * for the admin's review queue instead. The admin can hide a review but never
 * edit what a customer wrote. */

const PHONE = /(?:\+?88)?0?1[3-9]\d{8}|\d{7,}/;
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|xyz|shop|bd|info|link|me|io)\b/i;
/** A short list of common abuse in English, Banglish and Bangla. */
const ABUSE =
  /\b(?:fuck\w*|shit\w*|bastard|bitch\w*|madarchod|bokachoda|chuda|choda|khanki\w*|magi|haramjada|harami|shala|shuorer|kuttar bacha)\b|চুদ|খানকি|মাগি|হারামজাদা|শুয়োর|কুত্তার বাচ্চা|বোকাচোদা/i;

export function needsModeration(text: string): boolean {
  return PHONE.test(text) || LINK.test(text) || ABUSE.test(text);
}
