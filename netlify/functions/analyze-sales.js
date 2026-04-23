const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

let db, adminAuth;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
  if (serviceAccount.project_id) {
    initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore();
    adminAuth = getAuth();
  }
} catch (error) {
  console.warn("Firebase Admin SDK not initialized:", error.message);
}

const SYSTEM_PROMPT = `
あなたは外資系SaaS企業のトップAE兼営業マネージャーです。
営業担当者が入力した提案内容・商談メモ・メール文面をレビューし、受注確度を上げるためのフィードバックを返してください。

以下の観点で評価してください。
- 顧客理解
- 課題の深さ
- 提案価値
- 決裁者目線
- 価格懸念への対応
- 競合比較
- 次アクション
- 営業としての強さ

必ず以下のJSON形式のみで返してください。Markdownや説明文は不要です。

{
  "score": 0,
  "one_line_feedback": "",
  "strengths": ["", "", ""],
  "improvements": ["", "", ""],
  "rewritten_proposal": "",
  "questions_for_next_meeting": ["", "", "", "", ""],
  "gorilla_comment": ""
}

制約：
- scoreは0〜100の整数にしてください。
- strengthsは必ず3つにしてください。
- improvementsは3〜5つにしてください。
- questions_for_next_meetingは必ず5つにしてください。
- rewritten_proposalは営業担当者がそのまま使える自然な日本語にしてください。
- gorilla_commentは少しユーモアを入れつつ、前向きな一言にしてください。
- 入力内容にない情報を勝手に断定しないでください。
- 不足情報がある場合は、improvementsに不足情報として明示してください。
- 厳しいが、営業担当者の味方であるトーンにしてください。
`;

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "POSTリクエストのみ受け付けています。" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = "claude-haiku-4-5-20251001";

  if (!apiKey) {
    return jsonResponse(500, {
      error: "APIキーが設定されていません。"
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "JSONの形式が不正です。" });
  }

  let text = String(body.text || "").trim();

  if (!text) {
    return jsonResponse(400, { error: "提案内容を入力してください。" });
  }

  let originalText = text;
  let wasSummarized = false;

  if (text.length > 6000) {
    try {
      text = await summarizeText(text, apiKey);
      wasSummarized = true;
      console.log(`Summarized from ${originalText.length} to ${text.length} characters`);
    } catch (error) {
      console.error("Summarization failed:", error.message);
      return jsonResponse(500, {
        error: "テキストの要約に失敗しました。もう一度お試しください。"
      });
    }
  }

  const authHeader = event.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let userId = null;
  let isSubscribed = false;

  if (token && adminAuth && db) {
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      userId = decodedToken.uid;

      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        isSubscribed = userData.subscription === "active";

        if (!isSubscribed) {
          const today = new Date().toDateString();
          const usageData = userData.usage || {};
          const usageDate = usageData.date;
          const usageCount = usageData.count || 0;

          if (usageDate === today && usageCount >= 3) {
            return jsonResponse(429, {
              error: "本日の無料利用回数（3回）に達しました。プレミアムプランへアップグレードしてください。",
              remaining: 0
            });
          }
        }
      }
    } catch (error) {
      console.warn("Token verification failed:", error.message);
    }
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `以下の営業提案をレビューしてください。\n\n${text}`
          }
        ]
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return jsonResponse(response.status, {
        error: result.error?.message || "Anthropic APIの呼び出しに失敗しました。"
      });
    }

    const outputText = extractOutputText(result);

    if (!outputText) {
      return jsonResponse(500, { error: "AIからの回答を読み取れませんでした。" });
    }

    const feedback = safeJsonParse(outputText);

    if (!feedback) {
      console.error("JSON parse failed. Output text:", outputText.substring(0, 500));
      return jsonResponse(500, {
        error: "AIの回答がJSON形式ではありませんでした。もう一度お試しください。"
      });
    }

    if (userId && !isSubscribed && db) {
      try {
        const today = new Date().toDateString();
        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data() || {};
        const usageData = userData.usage || {};
        const currentCount = (usageData.date === today ? usageData.count : 0) || 0;

        await db.collection("users").doc(userId).set(
          {
            usage: {
              date: today,
              count: currentCount + 1
            }
          },
          { merge: true }
        );
      } catch (error) {
        console.error("Failed to update usage:", error.message);
      }
    }

    return jsonResponse(200, {
      ...normalizeFeedback(feedback),
      wasSummarized
    });
  } catch (error) {
    return jsonResponse(500, {
      error: error.message || "サーバー側でエラーが発生しました。"
    });
  }
};

function extractOutputText(result) {
  const content = result.content || [];
  const textParts = [];

  for (const block of content) {
    if (block.type === "text" && block.text) {
      textParts.push(block.text);
    }
  }

  return textParts.join("\n").trim();
}

function safeJsonParse(value) {
  try {
    let cleaned = value
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}(?=\s*$)/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    const parsed = JSON.parse(cleaned);
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error("Parsed value is not an object");
    }
    return parsed;
  } catch (error) {
    console.error("JSON parse error:", error.message, "Input length:", value.length, "First 300 chars:", value.substring(0, 300));
    return null;
  }
}

function normalizeFeedback(feedback) {
  return {
    score: clampScore(feedback.score),
    one_line_feedback: String(feedback.one_line_feedback || "提案の方向性はあります。あとは受注に近づく言葉へ磨き込みましょう。"),
    strengths: toArray(feedback.strengths).slice(0, 3),
    improvements: toArray(feedback.improvements).slice(0, 5),
    rewritten_proposal: String(feedback.rewritten_proposal || ""),
    questions_for_next_meeting: toArray(feedback.questions_for_next_meeting).slice(0, 5),
    gorilla_comment: String(feedback.gorilla_comment || "筋はあります。あとは商談前に一段だけ強くしましょう。ウホ。")
  };
}

function toArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function clampScore(value) {
  const number = Number(value);
  if (Number.isNaN(number)) return 60;
  return Math.max(0, Math.min(100, Math.round(number)));
}

async function summarizeText(longText, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `以下の営業商談記録またはメール内容を、重要な顧客課題・提案内容・懸念点を保ちながら6000文字以内に要約してください。\n\n${longText}`
        }
      ]
    })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || "サマライズに失敗しました");
  }

  return extractOutputText(result);
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}
