import "server-only";

// Demo mode serves bundled fixtures so the app runs without PayPal credentials.
// Live mode talks to the PayPal sandbox. Production PayPal is deliberately unsupported.
export const env = {
  paypalClientId: process.env.PAYPAL_CLIENT_ID ?? "",
  paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
  paypalWebhookId: process.env.PAYPAL_WEBHOOK_ID ?? "",
  paypalApiBase: "https://api-m.sandbox.paypal.com",
  anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  appPasscode: process.env.APP_PASSCODE ?? "",
  // Signs the unlock cookie; change it to sign everyone out.
  authSecret: process.env.AUTH_SECRET ?? "",
  dataDir: process.env.DATA_DIR ?? ".data",
};

export const isLive = () => process.env.FORCE_DEMO !== "1" && Boolean(env.paypalClientId && env.paypalClientSecret);
