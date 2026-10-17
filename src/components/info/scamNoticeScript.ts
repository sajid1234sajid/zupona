/** The pre-paint half of `ScamNotice`, kept out of the "use client" file so a
 * server component can call it. */

export const SCAM_NOTICE_KEY = "zupona:scam-note-closed";
/** A closed reminder comes back after this long: the warning matters most to
 * the shopper who has forgotten it. */
export const SCAM_NOTICE_SNOOZE_DAYS = 30;

/** Plain ES5, run inline ahead of the notice so a shopper who closed it never
 * sees it flash in and out. */
export const scamNoticeScript = `(function(){try{var t=Number(localStorage.getItem("${SCAM_NOTICE_KEY}"))||0;if(t&&Date.now()-t<${SCAM_NOTICE_SNOOZE_DAYS}*864e5)document.documentElement.setAttribute("data-scam-note-closed","");}catch(e){}})();`;
