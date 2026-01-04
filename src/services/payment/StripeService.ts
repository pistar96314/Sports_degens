import Stripe from "stripe";
import { logger } from "../../utils/logger";

export class StripeService {
  private stripe?: Stripe;

  private getClient(): Stripe {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    if (!this.stripe) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: "2024-06-20",
      });
    }

    return this.stripe;
  }

  /**
   * Create a customer in Stripe
   */
  async createCustomer(
    email: string,
    userId: string
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.getClient().customers.create({
        email,
        metadata: {
          userId,
        },
      });
      return customer;
    } catch (error) {
      logger.error("Error creating Stripe customer:", error);
      throw error;
    }
  }

  /**
   * Create a subscription for tools access
   */
  async createSubscription(
    customerId: string,
    priceId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.getClient().subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });
      return subscription;
    } catch (error) {
      logger.error("Error creating subscription:", error);
      throw error;
    }
  }

  /**
   * Create a checkout session for one-time payment or subscription
   */
  async createCheckoutSession(params: {
    customerId?: string;
    priceId: string;
    userId: string;
    successUrl: string;
    cancelUrl: string;
    mode: "payment" | "subscription";
  }): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.getClient().checkout.sessions.create({
        customer: params.customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: params.priceId,
            quantity: 1,
          },
        ],
        mode: params.mode,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: {
          userId: params.userId,
        },
      });
      return session;
    } catch (error) {
      logger.error("Error creating checkout session:", error);
      throw error;
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<Stripe.Event> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    try {
      const event = this.getClient().webhooks.constructEvent(
        payload,
        signature,
        webhookSecret
      );
      return event;
    } catch (error) {
      logger.error("Webhook signature verification failed:", error);
      throw error;
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.getClient().subscriptions.cancel(
        subscriptionId
      );
      return subscription;
    } catch (error) {
      logger.error("Error canceling subscription:", error);
      throw error;
    }
  }

  /**
   * Get subscription details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.getClient().subscriptions.retrieve(
        subscriptionId
      );
      return subscription;
    } catch (error) {
      logger.error("Error retrieving subscription:", error);
      throw error;
    }
  }
}

// export const stripeService = new StripeService();

let _stripeService: StripeService | null = null;

export function getStripeService(): StripeService {
  if (!_stripeService) {
    _stripeService = new StripeService();
  }
  return _stripeService;
}
