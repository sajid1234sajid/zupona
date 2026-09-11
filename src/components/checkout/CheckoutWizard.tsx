"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isServedLocation } from "@/data/locations";
import {
  CODE_TTL_SECONDS,
  normalizeBdPhone,
  type DeliveryDetails,
  type DeliveryMethod,
  type PaymentMethodId,
} from "@/lib/checkout";
import { placeOrderAction, sendCodeAction, type PlaceOrderState } from "@/app/checkout/actions";
import CheckoutHeader from "./CheckoutHeader";
import CheckoutStepper from "./CheckoutStepper";
import LeafBackdrop from "./LeafBackdrop";
import StepDetails from "./StepDetails";
import StepDelivery from "./StepDelivery";
import StepPayment from "./StepPayment";
import type { SummaryLine } from "./OrderSummary";

interface CheckoutWizardProps {
  /** Whether this is the cart being checked out or a single Buy Now line. The
   * server needs to know which, because the two are emptied differently. */
  source: "cart" | "buynow";
  /** Signed-out shoppers start on step 1 (the login step); everyone else skips it. */
  signedIn: boolean;
  initialDetails: DeliveryDetails;
  /** The number already confirmed in this browser, if any. */
  verifiedPhone: string | null;
  lines: SummaryLine[];
  subtotal: number;
  /** Delivery options priced from the admin Settings page. */
  deliveryMethods: DeliveryMethod[];
}

export default function CheckoutWizard({
  source,
  signedIn,
  initialDetails,
  verifiedPhone,
  lines,
  subtotal,
  deliveryMethods,
}: CheckoutWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(signedIn ? 2 : 1);
  const [details, setDetails] = useState<DeliveryDetails>(initialDetails);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cod");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [stepError, setStepError] = useState<string | undefined>();
  const [sending, startSending] = useTransition();

  /* One key for this attempt at placing an order, generated once when the
   * wizard mounts. A double-tapped button or a retried request carries the same
   * key, and the server returns the order it already wrote instead of writing a
   * second one. Navigating back into checkout mounts a fresh wizard and so
   * starts a genuinely new attempt. */
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`
  );

  const normalizedPhone = normalizeBdPhone(details.phone);
  const fee = deliveryMethods.find((method) => method.id === details.deliveryMethod)?.fee ?? 0;

  const [orderState, placeOrder, placing] = useActionState<PlaceOrderState, FormData>(
    placeOrderAction.bind(null, { ...details, paymentMethod, code, source, idempotencyKey }),
    {}
  );

  // A confirmation can lapse while the shopper is still on step 2, so an
  // expiry from the server drops the card back to an active code entry.
  const confirmationLapsed = /expired/i.test(orderState.error ?? "");
  const phoneVerified =
    normalizedPhone !== null && normalizedPhone === verifiedPhone && !confirmationLapsed;

  function patchDetails(patch: Partial<DeliveryDetails>) {
    setDetails((current) => ({ ...current, ...patch }));
    setStepError(undefined);
  }

  function sendCode(isResend = false) {
    startSending(async () => {
      const result = await sendCodeAction(details.phone);
      if (result.error) {
        setStepError(result.error);
        return;
      }
      setDemoCode(result.demoCode ?? null);
      setCodeSentAt(Date.now());
      if (isResend) setCode("");
    });
  }

  function goToPayment() {
    if (!details.fullName.trim()) {
      setStepError("Enter the name we should deliver to.");
      return;
    }
    if (!normalizedPhone) {
      setStepError("Enter a valid Bangladeshi mobile number, e.g. 01712345678.");
      return;
    }
    if (!isServedLocation(details.division, details.district, details.area)) {
      setStepError("Pick a division, district and area we deliver to.");
      return;
    }
    if (details.addressDetails.trim().length < 6) {
      setStepError("Enter your full address so the rider can find you.");
      return;
    }

    setStepError(undefined);
    // Cash on Delivery orders are only accepted against a confirmed number, so
    // a code goes out now unless this browser already confirmed this one.
    if (!phoneVerified) sendCode();
    setStep(3);
  }

  function goBack() {
    setStepError(undefined);
    if (step === 3) {
      setStep(2);
      return;
    }
    if (step === 2 && !signedIn) {
      setStep(1);
      return;
    }
    router.push("/cart");
  }

  return (
    <div /* Sampling the reference down the screen gives #fbfdfc at the top
       settling to a flat #f6fcf7 by a fifth of the way down, the same at the
       left edge as at the centre. So: white lifting into the wash, and nothing
       after that. The old three-stop gradient put a teal cast top and bottom
       that the design does not have. */
      className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-gradient-to-b from-white via-brand-mist via-[18%] to-brand-mist">
      <LeafBackdrop />

      <div className="relative flex flex-1 flex-col">
        <CheckoutHeader
          onBack={step === 1 ? undefined : goBack}
          secureNote={step === 3 ? "Your information is safe" : undefined}
        />

        <div className="pb-5 pt-1">
          <CheckoutStepper current={step} />
        </div>

        {step === 1 && <StepDetails />}

        {step === 2 && (
          <StepDelivery
            details={details}
            onChange={patchDetails}
            lines={lines}
            subtotal={subtotal}
            deliveryMethods={deliveryMethods}
            phoneVerified={phoneVerified}
            onContinue={goToPayment}
            pending={sending}
            error={stepError}
          />
        )}

        {step === 3 && (
          <form action={placeOrder}>
            <StepPayment
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              phone={normalizedPhone ?? details.phone}
              phoneVerified={phoneVerified}
              code={code}
              onCodeChange={setCode}
              onResend={() => sendCode(true)}
              resending={sending}
              demoCode={demoCode}
              resendAt={codeSentAt + CODE_TTL_SECONDS * 1000}
              lines={lines}
              subtotal={subtotal}
              deliveryFee={fee}
              pending={placing}
              error={orderState.error ?? stepError}
            />
          </form>
        )}
      </div>
    </div>
  );
}
