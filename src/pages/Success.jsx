import React from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function Success() {
  return (
    <main className="success-page">
      <section className="success-section">
        <div className="success-icon">
          <CheckCircle2 size={80} />
        </div>
        <h1>支払い完了！</h1>
        <p className="success-message">
          プレミアムプランへのアップグレードが完了しました。
        </p>
        <p className="success-description">
          これからセールスゴリラを無制限で利用できます。<br />
          営業提案をもっと強くしていきましょう！
        </p>
        <a href="/" className="success-button">
          セールスゴリラに戻る <ArrowRight size={18} />
        </a>
      </section>
    </main>
  );
}
