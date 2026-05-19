/* 자산 사진 AI 분석 — Claude Haiku Vision */

export const config = {
  api: { bodyParser: { sizeLimit: '6mb' } }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { image, mediaType } = req.body ?? {};
  if (!image) return res.status(400).json({ ok: false, error: '이미지가 없습니다.' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ ok: false, error: 'API 키가 설정되지 않았습니다. Vercel 환경 변수를 확인하세요.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image }
            },
            {
              type: 'text',
              text: `이 이미지에서 자산(장비/기기) 정보를 추출해 JSON으로만 응답하세요. JSON 외 텍스트 없이 JSON만 출력.

{"asset_name":"","maker":"","model":"","serial":""}

- asset_name: 기기 전체 이름 (예: "삼성 프린터 Xpress M2070")
- maker: 제조사 (예: "Samsung", "LG", "HP", "Canon", "Dell")
- model: 모델명/번호 (예: "Xpress M2070W")
- serial: S/N 또는 시리얼번호 (없으면 빈 문자열)

보이지 않는 정보는 빈 문자열로 두세요.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ ok: false, error: err.error?.message || `API 오류 (${response.status})` });
    }

    const result = await response.json();
    const text   = result.content?.[0]?.text ?? '';
    const match  = text.match(/\{[\s\S]*?\}/);

    if (!match) return res.status(200).json({ ok: false, error: '분석 결과를 파싱할 수 없습니다.' });

    return res.status(200).json({ ok: true, data: JSON.parse(match[0]) });

  } catch (err) {
    console.error('[analyze-asset]', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
