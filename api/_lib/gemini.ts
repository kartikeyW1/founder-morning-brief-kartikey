import { formatTimeIST } from './time.js';

interface CalendarEvent {
  time: string;
  endTime: string;
  title: string;
  location: string;
}

interface EmailMeta {
  sender: string;
  subject: string;
  receivedAt: string;
}

export interface GeminiAnalysis {
  priorities: string[];
  daySummary: string;
  keyMeetingIndices: number[];
}

function buildPrompt(
  events: CalendarEvent[],
  emails: EmailMeta[],
  dateStr: string
): { system: string; user: string } {
  const calendarBlock =
    events.length > 0
      ? events
          .map((e) => {
            const start = formatTimeIST(e.time);
            const end = formatTimeIST(e.endTime);
            const loc = e.location ? ` (${e.location})` : '';
            return `- ${start} – ${end}: ${e.title}${loc}`;
          })
          .join('\n')
      : 'No meetings today.';

  const emailBlock =
    emails.length > 0
      ? emails
          .map(
            (e, i) =>
              `${i + 1}. From: ${e.sender} | Subject: ${e.subject} | ${e.receivedAt}`
          )
          .join('\n')
      : 'No unread emails.';

  const system = `You are a concise executive assistant. Analyze today's calendar and unread emails for a startup founder. Be direct, no fluff.`;

  const user = `Today is ${dateStr}.

CALENDAR (${events.length} events):
${calendarBlock}

UNREAD EMAILS (${emails.length}):
${emailBlock}

RESPOND IN THIS EXACT JSON FORMAT:
{
  "priorities": ["action item 1", "action item 2"],
  "daySummary": "one or two sentence overview",
  "keyMeetingIndices": [0, 2]
}

RULES:
- priorities: 3-6 actionable items synthesized from calendar + emails.
  Start each with a verb. Most important first.
  ONLY reference meetings and emails provided above. Never invent events, people, or tasks that don't appear in the input.
  If multiple emails are from the same thread, treat as one item.
  Ignore promotional, newsletter, and automated notification emails.
  Handle email subjects in any language.
- daySummary: mention meeting count, busiest time block, unread count, and anything urgent. If no meetings, say so. If no emails, say so.
- keyMeetingIndices: indices (0-based) of high-stakes meetings (investor calls, board meetings, external parties, deadlines). Routine standups and 1:1s are NOT key. Return empty array if none are key.

If calendar is empty AND inbox is empty, return:
{
  "priorities": ["No scheduled events or pending emails - open day"],
  "daySummary": "Clear calendar and empty inbox.",
  "keyMeetingIndices": []
}`;

  return { system, user };
}

function parseGeminiJSON(text: string): GeminiAnalysis {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  const parsed = JSON.parse(cleaned);

  // Validate structure
  if (!Array.isArray(parsed.priorities) || typeof parsed.daySummary !== 'string' || !Array.isArray(parsed.keyMeetingIndices)) {
    throw new Error('Invalid Gemini response structure');
  }

  return {
    priorities: parsed.priorities.map(String),
    daySummary: String(parsed.daySummary),
    keyMeetingIndices: parsed.keyMeetingIndices
      .filter((i: unknown) => typeof i === 'number' && Number.isInteger(i) && i >= 0)
      .map(Number),
  };
}

export async function analyzeWithGemini(
  events: CalendarEvent[],
  emails: EmailMeta[],
  dateStr: string
): Promise<GeminiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const { system, user } = buildPrompt(events, emails, dateStr);

  const callGemini = async (): Promise<GeminiAnalysis> => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errBody}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty Gemini response');

    return parseGeminiJSON(text);
  };

  // Try once, retry on failure
  try {
    return await callGemini();
  } catch (firstErr) {
    console.error('Gemini first attempt failed:', firstErr);
    try {
      return await callGemini();
    } catch (retryErr) {
      console.error('Gemini retry failed:', retryErr);
      throw retryErr;
    }
  }
}
