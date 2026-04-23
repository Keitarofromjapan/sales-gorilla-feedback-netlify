const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "POSTリクエストのみ受け付けています。" });
  }

  const authHeader = event.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "認証が必要です。" });
  }

  const token = authHeader.slice(7);

  console.log("DEBUG: STRIPE_SECRET_KEY exists?", !!process.env.STRIPE_SECRET_KEY);
  console.log("DEBUG: STRIPE_PRICE_ID exists?", !!process.env.STRIPE_PRICE_ID);
  console.log("DEBUG: STRIPE_PRICE_ID value:", process.env.STRIPE_PRICE_ID);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1
        }
      ],
      mode: "subscription",
      success_url: `${process.env.URL || "http://localhost:8888"}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || "http://localhost:8888"}/pricing`
    });

    return jsonResponse(200, { sessionId: session.id });
  } catch (error) {
    console.error("Stripe error:", error.message);
    console.error("Stripe error details:", error);
    return jsonResponse(500, {
      error: `チェックアウトセッションの作成に失敗しました。: ${error.message}`
    });
  }
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}
