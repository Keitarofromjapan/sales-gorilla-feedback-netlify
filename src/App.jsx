import React, { useState, useEffect } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Flame, Loader2, Target, Zap, LogOut, LogIn, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import "./style.css";

const sampleInput = `顧客は従業員300名のIT代理店です。
現在はExcelで案件管理しており、営業ごとの活動量や失注理由が見えません。
SFA導入を提案したいのですが、Salesforceは高いと言われています。
提案の切り口としては、営業生産性向上とマネジメント強化を押したいです。`;

export function Home() {
  const [input, setInput] = useState(sampleInput);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remainingUsage, setRemainingUsage] = useState(3);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) {
      checkUsageLimit();
    } else {
      setRemainingUsage(3);
      setIsSubscribed(false);
    }
  }, [user]);

  const checkUsageLimit = async () => {
    if (!user) return;

    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsSubscribed(userData.subscription === "active");

        if (userData.subscription === "active") {
          setRemainingUsage(999);
        } else {
          const today = new Date().toDateString();
          const usageData = userData.usage || {};
          const usageDate = usageData.date;
          const usageCount = usageData.count || 0;

          if (usageDate === today) {
            setRemainingUsage(Math.max(0, 3 - usageCount));
          } else {
            setRemainingUsage(3);
          }
        }
      } else {
        setRemainingUsage(3);
      }
    } catch (error) {
      console.error("Failed to check usage:", error);
      setRemainingUsage(3);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("ログインエラー:", error);
    }
  };

  async function analyze() {
    setError("");
    setFeedback(null);

    if (!input.trim()) {
      setError("提案内容を入力してください。ゴリラも無からは詰められません。");
      return;
    }

    setLoading(true);

    try {
      const token = user ? await user.getIdToken() : null;
      const response = await fetch("/.netlify/functions/analyze-sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify({ text: input })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "フィードバックの生成に失敗しました。");
      }

      setFeedback(data);
      await checkUsageLimit();
    } catch (err) {
      setError(err.message || "エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <nav className="nav">
          <div className="brand">
            <div className="logo">🦍</div>
            <div>
              <p className="brand-title">セールスゴリラ フィードバック</p>
              <p className="brand-subtitle">営業提案AIレビュー</p>
            </div>
          </div>
          <div className="nav-actions">
            <a href="/pricing" className="nav-button">料金</a>
            {user ? (
              <>
                <span className="user-name">{user.displayName || user.email}</span>
                <button onClick={logout} className="logout-btn">
                  <LogOut size={16} /> ログアウト
                </button>
              </>
            ) : (
              <button onClick={handleGoogleLogin} className="login-btn">
                <LogIn size={16} /> ログイン
              </button>
            )}
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <div className="badge"><Zap size={16} /> 詰められる前に、AIに詰めてもらえ。</div>
            <h1>その提案、<span>上司に出す前に</span>ゴリラに通せ。</h1>
            <p className="lead">
              商談メモ・提案内容・メール文面を入力するだけ。AIが論点の甘さ、決裁者への刺さり方、価格懸念への返し、次アクションまで即レビューします。
            </p>
            <div className="hero-actions">
              <a href="#demo" className="primary">提案を鍛える <ArrowRight size={18} /></a>
              <a href="#features" className="secondary">使い方を見る</a>
            </div>
            <div className="checks">
              <span><CheckCircle2 size={16} /> 登録なしで体験</span>
              <span><CheckCircle2 size={16} /> 即時フィードバック</span>
              <span><CheckCircle2 size={16} /> BtoB営業向け</span>
            </div>
          </div>

          <div className="panel" id="demo">
            <div className="panel-head">
              <div>
                <h2>AIフィードバック体験</h2>
                <p>提案内容・商談メモをそのまま貼り付け</p>
              </div>
              <div className="panel-head-right">
                {user && !isSubscribed && (
                  <span className="usage-badge">
                    今日あと <strong>{remainingUsage}</strong> 回
                  </span>
                )}
                {isSubscribed && (
                  <span className="premium-badge">プレミアム</span>
                )}
                <span className="mini-badge">β版</span>
              </div>
            </div>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例：顧客情報、課題、提案したい内容、懸念点などを入力"
            />

            <button className="analyze" onClick={analyze} disabled={loading}>
              {loading ? <><Loader2 className="spin" size={18} /> ゴリラ確認中...</> : "ゴリラに詰めてもらう"}
            </button>

            {error && <div className="error">{error}</div>}

            {feedback && (
              <div className="result">
                <div className="score-card">
                  <div>
                    <p>提案スコア</p>
                    <strong>{feedback.score}<small>/100</small></strong>
                  </div>
                  <span>{feedback.one_line_feedback}</span>
                </div>

                <div className="result-grid">
                  <ResultBox icon={<Flame size={18} />} title="良い点" items={feedback.strengths} />
                  <ResultBox icon={<Target size={18} />} title="改善ポイント" items={feedback.improvements} />
                </div>

                <div className="text-box">
                  <h3><ClipboardCheck size={18} /> 改善後の提案文</h3>
                  <p>{feedback.rewritten_proposal}</p>
                </div>

                <div className="text-box">
                  <h3>次回商談で聞くべき質問</h3>
                  <ul>
                    {feedback.questions_for_next_meeting?.map((q, index) => <li key={index}>{q}</li>)}
                  </ul>
                </div>

                <div className="gorilla-comment">🦍 {feedback.gorilla_comment}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="section-title">
          <p>商談前の壁打ちAI</p>
          <h2>文章添削ではない。受注確度を上げる営業レビューです。</h2>
        </div>
        <div className="feature-grid">
          <article>
            <h3>決裁者目線に変換</h3>
            <p>担当者向けの便利さを、役員・管理職が投資判断できる言葉に引き上げます。</p>
          </article>
          <article>
            <h3>価格懸念への返し</h3>
            <p>「高いです」に対して、値引きではなく放置コストや機会損失から返す切り口を出します。</p>
          </article>
          <article>
            <h3>次アクション設計</h3>
            <p>次回商談で何を聞くべきか、誰を巻き込むべきかまで具体化します。</p>
          </article>
        </div>
      </section>
    </main>
  );
}

function ResultBox({ icon, title, items = [] }) {
  return (
    <div className="result-box">
      <h3>{icon} {title}</h3>
      <ul>
        {items.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    </div>
  );
}
