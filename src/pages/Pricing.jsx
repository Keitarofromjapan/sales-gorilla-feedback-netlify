import React, { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useAuth } from "../AuthContext";

export function Pricing() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleCheckout = async () => {
    if (!user) {
      alert("ログインしてからアップグレードしてください。");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/.netlify/functions/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (data.sessionId) {
        window.location.href = `https://checkout.stripe.com/pay/${data.sessionId}`;
      } else {
        alert("決済ページの作成に失敗しました。");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pricing-page">
      <nav className="pricing-nav">
        <a href="/" className="back-link">
          <ArrowLeft size={18} /> セールスゴリラに戻る
        </a>
      </nav>

      <section className="pricing-section">
        <div className="pricing-header">
          <h1>シンプルな料金プラン</h1>
          <p>セールスゴリラで営業提案をもっと強くしよう</p>
        </div>

        <div className="pricing-cards">
          <div className="pricing-card">
            <div className="plan-name">フリープラン</div>
            <div className="plan-price">
              <span className="currency">無料</span>
            </div>
            <div className="plan-description">登録なしで試す</div>
            <ul className="plan-features">
              <li><Check size={18} /> 1日3回まで利用可能</li>
              <li><Check size={18} /> すべての機能を利用可能</li>
              <li><Check size={18} /> メールサポート</li>
            </ul>
            <button className="plan-button" disabled>
              現在のプラン
            </button>
          </div>

          <div className="pricing-card premium">
            <div className="plan-badge">人気</div>
            <div className="plan-name">プレミアムプラン</div>
            <div className="plan-price">
              <span className="price-main">¥980</span>
              <span className="price-period">/月</span>
            </div>
            <div className="plan-description">無制限で利用</div>
            <ul className="plan-features">
              <li><Check size={18} /> 無制限で利用可能</li>
              <li><Check size={18} /> すべての機能を利用可能</li>
              <li><Check size={18} /> 優先サポート</li>
              <li><Check size={18} /> 今後の新機能も利用可能</li>
            </ul>
            <button
              className="plan-button primary"
              onClick={handleCheckout}
              disabled={loading}
            >
              {loading ? "処理中..." : "今すぐアップグレード"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
