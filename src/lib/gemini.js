// Gemini 2.0 Flash client — extracts structured label data from an image.
// Free tier via Google AI Studio. Single round-trip keeps latency well
// under the 5-second budget the Compliance Division requires.

const MODEL = "gemini-2.0-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const EXTRACTION_PROMPT = `You are an OCR and information-extraction system for US TTB alcohol beverage labels.
Examine the label image and return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:

{
  "brandName": string | null,           // brand name exactly as printed, preserving capitalization and punctuation
  "classType": string | null,           // class/type designation, e.g. "Kentucky Straight Bourbon Whiskey"
  "alcoholContent": string | null,      // alcohol statement exactly as printed, e.g. "45% Alc./Vol. (90 Proof)"
  "netContents": string | null,         // net contents exactly as printed, e.g. "750 mL"
  "bottlerInfo": string | null,         // bottler/producer name and address as printed
  "countryOfOrigin": string | null,     // country of origin statement if present, e.g. "Product of France"
  "governmentWarningText": string | null, // the FULL government warning exactly as printed, character for character, preserving capitalization
  "warningPrefixAppearsBold": boolean | null, // does "GOVERNMENT WARNING:" appear in bold type?
  "imageQualityIssues": string | null,  // glare, angle, blur, low light — null if image is clean
  "confidence": "high" | "medium" | "low"
}

Rules:
- Transcribe text EXACTLY as printed. Never normalize capitalization or fix typos — exactness is the point.
- Use null for any field not visible on the label.
- If the image is at an angle, has glare, or poor lighting, still extract what you can and describe the problem in imageQualityIssues.`;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function parseModelJson(text) {
  // Defensive parse: strip accidental markdown fences, find outer braces.
  const cleaned = text.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model returned no JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function extractLabelData(file, apiKey) {
  if (!apiKey) {
    throw new Error(
      "Missing Gemini API key. Set VITE_GEMINI_API_KEY in your .env file."
    );
  }
  const started = performance.now();
  const base64 = await fileToBase64(file);

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: EXTRACTION_PROMPT },
            {
              inline_data: {
                mime_type: file.type || "image/jpeg",
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429)
      throw new Error("Gemini rate limit reached (free tier). Wait a moment and retry.");
    throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("");
  if (!text) throw new Error("Empty response from Gemini.");

  const extracted = parseModelJson(text);
  const elapsedMs = Math.round(performance.now() - started);
  return { extracted, elapsedMs };
}
