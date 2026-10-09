/** The pre-paint half of `AppBanner`, kept out of that file because the root
 * layout -- a server component -- calls it, and anything exported from a
 * "use client" module is only a reference on the server. */

export const CLOSED_KEY = "zupona:app-banner-closed";
export const INSTALLED_KEY = "zupona:app-installed";

/** The decision itself, run inline before the banner is parsed. Plain ES5 and
 * self-contained: it runs ahead of every bundle, so it can import nothing.
 *
 * It also holds on to Chrome's install prompt. That event can fire before
 * React hydrates, and one that nobody kept is gone for the visit. */
export function appBannerScript(snoozeDays: number): string {
  return `(function(){
addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__zuponaInstall=e;});
try{
if(/^(admin|seller)\\./.test(location.hostname))return;
if(matchMedia("(display-mode: standalone)").matches||navigator.standalone||document.referrer.indexOf("android-app://")===0)return;
if(localStorage.getItem("${INSTALLED_KEY}"))return;
var t=Number(localStorage.getItem("${CLOSED_KEY}"))||0;
if(t&&Date.now()-t<${snoozeDays}*864e5)return;
document.documentElement.setAttribute("data-app-banner","");
}catch(e){}
})();`;
}
