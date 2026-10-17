/** The Help center's questions and answers.
 *
 * Each answer is a function of the shop's real figures, so "how much is
 * delivery" quotes the fee checkout charges and "how long do I have to return"
 * quotes the window in Settings -- an answer can never state a number the shop
 * does not use. Answers are plain text: the page searches them in the browser,
 * and they are also published as FAQPage structured data for search engines.
 *
 * To add a question, add it to its topic. Keep answers short and true today:
 * a feature that is coming soon is described as coming soon. */

import type { PolicyFacts } from "@/lib/policyFacts";
import { days, listJoin } from "@/lib/policyFacts";
import { formatPrice } from "@/lib/format";

export interface FaqTopic {
  id: string;
  title: string;
  items: { q: string; a: (facts: PolicyFacts) => string }[];
}

const freeLine = (f: PolicyFacts) =>
  f.freeShippingThreshold > 0
    ? ` Delivery is free when your items come to more than ${formatPrice(f.freeShippingThreshold)}.`
    : "";

const returnWindow = (f: PolicyFacts) =>
  f.returnDays > 0
    ? `You can request a return within ${days(f.returnDays)} of delivery.`
    : "Contact us as soon as you notice the problem.";

export const FAQ_TOPICS: FaqTopic[] = [
  {
    id: "orders",
    title: "Orders",
    items: [
      {
        q: "How do I place an order?",
        a: () =>
          "Open a product, choose the size or colour if it has them, and tap Buy Now or Add to Cart. At checkout, enter your name, mobile number and address, verify your number with the code we send by SMS, and confirm. You do not need to create an account first.",
      },
      {
        q: "How do I know my order was placed?",
        a: () =>
          "You see a confirmation page with your order number straight away, and the order appears in My Orders with its status.",
      },
      {
        q: "Can I cancel my order?",
        a: () =>
          "Yes, before it is shipped. Message us on WhatsApp with your order number and we will cancel it. Once it has been handed to the courier it can no longer be cancelled, but you can refuse it or return it under our return policy.",
      },
      {
        q: "Can I change my delivery address or phone number?",
        a: () =>
          "Message us with your order number and the new details as soon as possible. We can change them until the order is shipped.",
      },
      {
        q: "My order is still not confirmed. What should I do?",
        a: () =>
          "Our team confirms each order before it is packed. If yours is still waiting, keep your phone on in case we call, or message us on WhatsApp with the order number.",
      },
    ],
  },
  {
    id: "delivery",
    title: "Delivery",
    items: [
      {
        q: "How much is delivery?",
        a: (f) =>
          `Delivery costs ${formatPrice(f.deliveryFee)} per order.${freeLine(f)} Products marked “Free delivery” ship free when your order holds only those products. Checkout always shows the exact fee before you confirm.`,
      },
      {
        q: "How long does delivery take?",
        a: (f) =>
          `Usually ${f.deliveryDays.min}–${f.deliveryDays.max} days after your order is confirmed, anywhere in Bangladesh. Holidays and remote areas can add a day or two.`,
      },
      {
        q: "How do I track my order?",
        a: () =>
          "Open My Orders in your account. Each order shows its current status and every step it has passed through.",
      },
      {
        q: "The courier didn't call me. What now?",
        a: () =>
          "Check that the phone number on your order is right and switched on, then message us on WhatsApp with your order number and we will contact the courier.",
      },
      {
        q: "Do you deliver outside Dhaka?",
        a: () => "Yes. We deliver to all 64 districts of Bangladesh.",
      },
    ],
  },
  {
    id: "payment",
    title: "Payment",
    items: [
      {
        q: "How can I pay?",
        a: (f) => `We accept ${listJoin(f.paymentMethods)}.`,
      },
      {
        q: "How does Cash on Delivery work?",
        a: () =>
          "You pay the courier in cash when your parcel arrives. Pay only the amount shown on your order, never more.",
      },
      {
        q: "Will Zupona ever ask me to pay in advance to a personal number?",
        a: () =>
          "Never. Zupona does not ask for advance payment to a personal bKash or Nagad number, and never asks for your OTP. If someone does, it is a scam: please report it to us.",
      },
      {
        q: "How do refunds get paid?",
        a: () =>
          "Once a returned item reaches us and passes a check, we refund it. For a Cash on Delivery order, we agree with you how to send the refund. See our return policy for details.",
      },
    ],
  },
  {
    id: "returns",
    title: "Returns & refunds",
    items: [
      {
        q: "Can I return an item?",
        a: (f) =>
          `Yes, if it arrives damaged, wrong or not as described. ${returnWindow(f)} Items must be unused and in their original packaging.`,
      },
      {
        q: "How do I start a return?",
        a: () =>
          "Message us on WhatsApp with your order number, what is wrong, and a photo of the item. We will tell you the next step.",
      },
      {
        q: "Can I exchange for a different size or colour?",
        a: (f) =>
          f.exchangeDays > 0
            ? `Yes, within ${days(f.exchangeDays)} of delivery, depending on stock.`
            : "Ask us. Exchanges depend on stock and the condition of the item.",
      },
      {
        q: "Which items cannot be returned?",
        a: () =>
          "Items marked non-returnable on their product page, and items that come back used or without their original packaging.",
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      {
        q: "I didn't receive the verification code.",
        a: () =>
          "Wait a minute and check that the number is right. You can ask for a new code when the timer ends. If it still doesn't arrive, message us on WhatsApp.",
      },
      {
        q: "How do I change my name or phone number?",
        a: () => "Open My Account and tap Edit Profile.",
      },
      {
        q: "How do I delete my account?",
        a: () =>
          "Message us on WhatsApp from the number on your account. We will confirm it is you, then delete your personal information. Records of past orders are kept as the law requires.",
      },
    ],
  },
  {
    id: "points",
    title: "Points & coupons",
    items: [
      {
        q: "How do I earn points?",
        a: () =>
          "You earn 1 point for every ৳50 you spend on an order. Your points and their history are in My Account, under Points.",
      },
      {
        q: "How do I use a coupon?",
        a: () =>
          "Collect coupons on the Offers page when any are running, then apply one at checkout. The coupon's conditions are shown on it.",
      },
    ],
  },
  {
    id: "selling",
    title: "Selling on Zupona",
    items: [
      {
        q: "How do I sell on Zupona?",
        a: () =>
          "Tap “Sell on Zupona” at the bottom of any page and open a shop with your name, mobile number and store name. We review every new shop before it can sell.",
      },
      {
        q: "Who delivers products sold by other shops?",
        a: () =>
          "Every order is placed and tracked on Zupona the same way, whichever shop sells the item, and our support helps you with all of them.",
      },
    ],
  },
  {
    id: "safety",
    title: "Safety",
    items: [
      {
        q: "How do I know a page or message is really from Zupona?",
        a: () =>
          "Our website is zupona.com. Real orders always appear in My Orders. We never ask for advance payment to a personal number or for your OTP.",
      },
      {
        q: "How do I report a scam?",
        a: () =>
          "Send us a screenshot on WhatsApp. We use reports to warn other customers.",
      },
    ],
  },
];
