// Stripe implementation of IPaymentProvider for dunning.
// Calls Stripe to retry subscription invoices and cancel subscriptions.

import Stripe from "stripe";
import type { IPaymentProvider, ChargeResult, PaymentMethodStatus, RefundResult } from "@workspace/providers";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  // @ts-ignore - Stripe apiVersion
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

export class StripeDunningAdapter implements IPaymentProvider {
  async retryCharge(subscriptionId: string): Promise<ChargeResult> {
    try {
      const stripe = getStripe();

      // Find the latest open invoice for this subscription and pay it
      const invoices = await stripe.invoices.list({
        subscription: subscriptionId,
        status: "open",
        limit: 1,
      });

      const invoice = invoices.data[0];
      if (!invoice) {
        return { success: false, errorCode: "no_open_invoice", errorMessage: "No open invoice found" };
      }

      const paid = await stripe.invoices.pay(invoice.id);
      return { success: paid.status === "paid" };
    } catch (err) {
      if (err instanceof Stripe.errors.StripeCardError) {
        return {
          success: false,
          errorCode: err.code ?? "card_declined",
          errorMessage: err.message,
        };
      }
      throw err; // retryable Stripe errors bubble up to BullMQ retry
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(subscriptionId);
  }

  async getPaymentMethodStatus(customerId: string): Promise<PaymentMethodStatus> {
    const stripe = getStripe();
    const methods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    const pm = methods.data[0];
    if (!pm?.card) {
      return { valid: false };
    }

    const now = new Date();
    const expiry = new Date(pm.card.exp_year, pm.card.exp_month - 1, 1);
    return {
      valid: expiry > now,
      last4: pm.card.last4,
      brand: pm.card.brand,
      expiryMonth: pm.card.exp_month,
      expiryYear: pm.card.exp_year,
    };
  }

  async createRefund(paymentIntentId: string, amountCents: number, reason: string): Promise<RefundResult> {
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountCents,
      reason: reason as Stripe.RefundCreateParams.Reason,
    });
    return { refundId: refund.id };
  }
}
