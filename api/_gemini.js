/* Gemini API 공통 클라이언트 */

const MODEL   = 'gemini-3.1-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/**
 * Gemini에 메시지를 보내고 텍스트 응답을 반환한다.
 * @param {Array<{role:'user'|'model', parts: Array}>} contents
 * @returns {Promise<string>}
 */
export async function geminiChat(contents) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');

  const res = await fetch(`${API_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API 오류 (${res.status})`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

/**
 * 이미지 + 텍스트 프롬프트를 Gemini Vision으로 분석한다.
 * @param {string} base64   이미지 base64 (data: 접두사 제외)
 * @param {string} mimeType 예: 'image/jpeg'
 * @param {string} prompt   텍스트 프롬프트
 * @returns {Promise<string>}
 */
export async function geminiVision(base64, mimeType, prompt) {
  return geminiChat([{
    role: 'user',
    parts: [
      { inline_data: { mime_type: mimeType, data: base64 } },
      { text: prompt }
    ]
  }]);
}
