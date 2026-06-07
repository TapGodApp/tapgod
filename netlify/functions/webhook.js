exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const payload = JSON.parse(event.body);
    const eventName = payload.meta?.event_name;
    const userEmail = payload.data?.attributes?.user_email || 
                      payload.data?.attributes?.customer_email;

    console.log('Webhook event:', eventName);
    console.log('User email:', userEmail);

    if (!userEmail) {
      return { statusCode: 200, body: 'No email found' };
    }

    const { createClient } = require('@supabase/supabase-js');
    const db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Get user by email
    const { data: users } = await db.auth.admin.listUsers();
    const user = users?.users?.find(u => u.email === userEmail);

    if (!user) {
      console.log('User not found:', userEmail);
      return { statusCode: 200, body: 'User not found' };
    }

    if (eventName === 'subscription_created' || eventName === 'subscription_resumed') {
      // Add active subscription
      await db.from('subscriptions').upsert({
        user_id: user.id,
        status: 'active'
      }, { onConflict: 'user_id' });
      console.log('Subscription activated for:', userEmail);
    }

    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
      // Cancel subscription
      await db.from('subscriptions').upsert({
        user_id: user.id,
        status: 'cancelled'
      }, { onConflict: 'user_id' });
      console.log('Subscription cancelled for:', userEmail);
    }

    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.log('Webhook error:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
