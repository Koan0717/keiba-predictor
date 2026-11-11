// ==================================================================================
// Firebase Auth の ID トークン (JWT) をサーバー側で検証する
// ==================================================================================
// ブラウザは Firebase でサインインすると「ID トークン」を受け取り、
// API を呼ぶときに Authorization: Bearer <トークン> として送ってくる。
// トークンは誰でも作れる文字列なので、ここで「本当に Google (Firebase) が発行したもので、
// このアプリ宛てで、期限内か」を確かめてから、中の uid をユーザーとして信用する。
//
// 確認項目 (Firebase 公式の「サードパーティの JWT ライブラリで検証する」手順と同じ):
//   ヘッダー  alg = RS256、kid = Google の公開鍵のどれか
//   署名      その公開鍵で RSASSA-PKCS1-v1_5 / SHA-256 の署名が正しい
//   exp       未来 (期限切れでない)
//   iat       過去 (未来に発行されたトークンではない)
//   aud       自分の Firebase プロジェクト ID
//   iss       https://securetoken.google.com/<プロジェクト ID>
//   sub       空でない (= ユーザーの uid)
// Firebase Admin SDK は Workers で動かないため、標準の WebCrypto だけで実装している。

export type FirebaseUser = { uid: string; name: string; email: string; picture: string };

// Google が公開している、Firebase のトークン署名用の公開鍵 (JWK 形式)
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const SKEW = 60; // サーバー間の時計のずれを 60 秒まで許す

type JwksFetcher = () => Promise<{ keys: JsonWebKey[]; maxAge: number }>;

const defaultFetcher: JwksFetcher = async () => {
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`公開鍵を取得できません: HTTP ${res.status}`);
  // 鍵はときどき入れ替わる。Cache-Control の max-age の間だけ使い回す
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] ?? 3600);
  return { keys: ((await res.json()) as any).keys, maxAge };
};

let fetcher = defaultFetcher;
let cache: { keys: Map<string, CryptoKey>; until: number } | null = null;

/** テスト用: 公開鍵の取得元を差し替える */
export function setJwksFetcher(f: JwksFetcher | null) {
  fetcher = f ?? defaultFetcher;
  cache = null;
}

async function keyFor(kid: string, now: number): Promise<CryptoKey | undefined> {
  if (!cache || cache.until < now || !cache.keys.has(kid)) {
    const { keys, maxAge } = await fetcher();
    const map = new Map<string, CryptoKey>();
    for (const jwk of keys as (JsonWebKey & { kid?: string })[]) {
      if (!jwk.kid) continue;
      map.set(jwk.kid, await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]));
    }
    cache = { keys: map, until: now + maxAge };
  }
  return cache.keys.get(kid);
}

const b64urlBytes = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
};
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

/** 正しいトークンならユーザー情報を、そうでなければ null を返す (理由は外に漏らさない) */
export async function verifyIdToken(token: string, projectId: string, now = Math.floor(Date.now() / 1000)): Promise<FirebaseUser | null> {
  if (!projectId || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const header = b64urlJson(parts[0]);
    const p = b64urlJson(parts[1]);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    const key = await keyFor(header.kid, now);
    if (!key) return null;
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    if (typeof p.exp !== "number" || p.exp + SKEW < now) return null;
    if (typeof p.iat !== "number" || p.iat - SKEW > now) return null;
    if (typeof p.auth_time === "number" && p.auth_time - SKEW > now) return null;
    if (p.aud !== projectId || p.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof p.sub !== "string" || !p.sub || p.sub.length > 128) return null;
    return { uid: p.sub, name: String(p.name ?? ""), email: String(p.email ?? ""), picture: String(p.picture ?? "") };
  } catch {
    return null; // 壊れたトークン (base64 や JSON として読めない) は不正として扱う
  }
}
