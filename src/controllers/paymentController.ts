import { Request, Response } from 'express';
import { stripeService } from '../services/payment/StripeService';
import { User } from '../models/User';
import { Subscription } from '../models/Subscription';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * Create Stripe checkout session for subscription
 */
export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Unauthorized' },
      } as ApiResponse);
      return;
    }

    const { priceId } = req.body;

    if (!priceId) {
      res.status(400).json({
        success: false,
        error: { message: 'Price ID is required' },
      } as ApiResponse);
      return;
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found' },
      } as ApiResponse);
      return;
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(user.email, userId);
      customerId = customer.id;
      
      // Update user with Stripe customer ID
      user.stripeCustomerId = customerId;
      await user.save();
    }

    // Create checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const session = await stripeService.createCheckoutSession({
      customerId,
      priceId,
      userId,
      successUrl: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/payment/cancel`,
      mode: 'subscription',
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
      },
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error creating checkout session:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to create checkout session' },
    } as ApiResponse);
  }
};

/**
 * Get subscription status for current user
 */
export const getSubscriptionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Unauthorized' },
      } as ApiResponse);
      return;
    }

    // Get subscription from database
    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      res.json({
        success: true,
        data: {
          hasSubscription: false,
          hasToolsAccess: false,
        },
      } as ApiResponse);
      return;
    }

    // Get latest status from Stripe
    const stripeSubscription = await stripeService.getSubscription(
      subscription.stripeSubscriptionId
    );

    // Update local subscription status
    subscription.status = stripeSubscription.status as any;
    subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;
    await subscription.save();

    // Update user's tools access
    const user = await User.findById(userId);
    if (user) {
      const hasAccess = stripeSubscription.status === 'active' || stripeSubscription.status === 'trialing';
      user.hasToolsAccess = hasAccess;
      if (hasAccess && !user.toolsSubscriptionExpiry) {
        user.toolsSubscriptionExpiry = new Date(stripeSubscription.current_period_end * 1000);
      }
      await user.save();
    }

    res.json({
      success: true,
      data: {
        hasSubscription: true,
        hasToolsAccess: subscription.status === 'active' || subscription.status === 'trialing',
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error getting subscription status:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to get subscription status' },
    } as ApiResponse);
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { message: 'Unauthorized' },
      } as ApiResponse);
      return;
    }

    // Get subscription from database
    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      res.status(404).json({
        success: false,
        error: { message: 'No active subscription found' },
      } as ApiResponse);
      return;
    }

    // Cancel subscription in Stripe
    const canceledSubscription = await stripeService.cancelSubscription(
      subscription.stripeSubscriptionId
    );

    // Update local subscription
    subscription.status = canceledSubscription.status as any;
    subscription.canceledAt = new Date();
    subscription.cancelAtPeriodEnd = canceledSubscription.cancel_at_period_end || false;
    await subscription.save();

    // Update user's tools access (will be revoked at period end)
    const user = await User.findById(userId);
    if (user && canceledSubscription.status === 'canceled') {
      user.hasToolsAccess = false;
      await user.save();
    }

    res.json({
      success: true,
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        message: subscription.cancelAtPeriodEnd
          ? 'Subscription will cancel at period end'
          : 'Subscription canceled immediately',
      },
    } as ApiResponse);
  } catch (error: any) {
    logger.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to cancel subscription' },
    } as ApiResponse);
  }
};

/**
 * Handle Stripe webhook events
 */
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).json({
      success: false,
      error: { message: 'Missing stripe-signature header' },
    } as ApiResponse);
    return;
  }

  try {
    // req.body is a Buffer when using express.raw()
    const body = req.body as Buffer;
    
    // Verify webhook signature
    const event = await stripeService.handleWebhook(body, sig as string);

    logger.info(`Received Stripe webhook: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: { message: `Webhook Error: ${error.message}` },
    } as ApiResponse);
  }
};

/**
 * Handle checkout session completed
 */
async function handleCheckoutCompleted(session: any): Promise<void> {
  const userId = session.metadata?.userId;
  const customerId = session.customer;

  if (!userId || !customerId) {
    logger.warn('Checkout completed but missing userId or customerId');
    return;
  }

  // Update user with Stripe customer ID if not set
  const user = await User.findById(userId);
  if (user && !user.stripeCustomerId) {
    user.stripeCustomerId = customerId;
    await user.save();
  }
}

/**
 * Handle subscription created/updated
 */
async function handleSubscriptionUpdate(subscription: any): Promise<void> {
  const customerId = subscription.customer;
  const subscriptionId = subscription.id;

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    logger.warn(`User not found for customer: ${customerId}`);
    return;
  }

  // Create or update subscription record
  let subscriptionRecord = await Subscription.findOne({ userId: user._id });

  if (!subscriptionRecord) {
    subscriptionRecord = new Subscription({
      userId: user._id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: subscription.items.data[0]?.price.id || '',
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
    });
  } else {
    subscriptionRecord.status = subscription.status as any;
    subscriptionRecord.currentPeriodStart = new Date(subscription.current_period_start * 1000);
    subscriptionRecord.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    subscriptionRecord.cancelAtPeriodEnd = subscription.cancel_at_period_end || false;
  }

  await subscriptionRecord.save();

  // Update user's tools access
  const hasAccess = subscription.status === 'active' || subscription.status === 'trialing';
  user.hasToolsAccess = hasAccess;
  user.toolsSubscriptionExpiry = new Date(subscription.current_period_end * 1000);
  await user.save();

  logger.info(`Updated subscription for user ${user._id}: ${subscription.status}`);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscription: any): Promise<void> {
  const customerId = subscription.customer;

  // Find user by Stripe customer ID
  const user = await User.findOne({ stripeCustomerId: customerId });

  if (!user) {
    logger.warn(`User not found for customer: ${customerId}`);
    return;
  }

  // Update subscription record
  const subscriptionRecord = await Subscription.findOne({ userId: user._id });
  if (subscriptionRecord) {
    subscriptionRecord.status = 'canceled';
    subscriptionRecord.canceledAt = new Date();
    await subscriptionRecord.save();
  }

  // Revoke tools access
  user.hasToolsAccess = false;
  user.toolsSubscriptionExpiry = undefined;
  await user.save();

  logger.info(`Revoked tools access for user ${user._id}`);
}

