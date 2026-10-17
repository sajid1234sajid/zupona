import { permanentRedirect } from "next/navigation";

/** `/faq` is where people guess the questions live; they live in the Help
 * center. */
export default function FaqPage() {
  permanentRedirect("/support");
}
