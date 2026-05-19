/* 자산 사진 AI 분석 — Gemini 3.1 Flash Lite Vision */

export const config = {
  api: { bodyParser: { sizeLimit: '6mb' } }
};

const MODEL   = 'gemini-3.1-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = `이 이미지에서 자산(장비/기기) 정보를 추출해 JSON으로만 응답하세요. JSON 외 텍스트 없이 JSON만 출력.

{"asset_name":"","maker":"","model":"","serial":""}

- asset_name: 기기 전체 이름 (예: "삼성 프린터 Xpress M2070")
- maker: 제조사 (예: "Samsung", "LG", "HP", "Canon", "Dell")
- model: 모델명/번호 (예: "Xpress M2070W")
- serial: S/N 또는 시리얼번호 (없으면 빈 문자열)

보이지 않는 정보는 빈 문자열로 두세요.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { image, mediaType } = req.body ?? {};
  if (!image) return res.status(400).json({ ok: false, error: '이미지가 없습니다.' });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });

  try {
    const response = await fetch(`${API_URL}?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mediaType || 'image/jpeg', data: image } },
            { text: PROMPT }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ ok: false, error: err.error?.message || `API 오류 (${response.status})` });
    }

    const result = await response.json();
    const text   = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const match  = text.match(/\{[\s\S]*?\}/);

    if (!match) return res.status(200).json({ ok: false, error: '분석 결과를 파싱할 수 없습니다.' });

    return res.status(200).json({ ok: true, data: JSON.parse(match[0]) });

  } catch (err) {
    console.error('[analyze-asset]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
