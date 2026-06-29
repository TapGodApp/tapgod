exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // Get raw body — never JSON.parse before signature verification
    const rawBody = event.isBase64Encoded 
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const sig = event.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let stripeEvent;
    try {
      stripeEvent = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch(err) {
      console.error('Webhook signature failed:', err.message);
      return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const eventType = stripeEvent.type;
    console.log('Stripe event:', eventType);

    if (eventType === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const userId = session.client_reference_id;
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (!userId) {
        console.error('No client_reference_id in session');
        return { statusCode: 200, body: 'No user ID' };
      }

      await supabase.from('subscriptions').upsert({
        user_id: userId,
        status: 'active',
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId
      }, { onConflict: 'user_id' });

      console.log('Subscription activated for user:', userId);
    }

    if (eventType === 'customer.subscription.updated') {
      const sub = stripeEvent.data.object;
      const status = sub.status === 'trialing' ? 'active' : sub.status;
      
      await supabase.from('subscriptions')
        .update({ status })
        .eq('stripe_subscription_id', sub.id);

      console.log('Subscription updated:', sub.id, status);
    }

    if (eventType === 'customer.subscription.deleted') {
      const sub = stripeEvent.data.object;
      
      await supabase.from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('stripe_subscription_id', sub.id);

      console.log('Subscription cancelled:', sub.id);
    }

    return { statusCode: 200, body: 'OK' };

  } catch(err) {
    console.error('Webhook error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
