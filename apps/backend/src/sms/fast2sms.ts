// Fast2SMS DLT-manual route. The composed message text must match the
// DLT-registered template body exactly (with {otp} substituted) or Indian
// telco scrubbing rejects it.

import { config } from '../config.js';

interface Fast2SmsResponse {
  return?: boolean;
  request_id?: string;
  message?: string | string[];
}

export async function sendSmsOtp(phoneE164: string, otp: string): Promise<{ requestId?: string }> {
  // Fast2SMS expects 10-digit Indian numbers without the country code.
  const number = phoneE164.replace(/^\+?91/, '').replace(/\D/g, '');
  if (number.length !== 10) {
    throw new Error(`unsupported phone for Fast2SMS: ${phoneE164}`);
  }

  const message = config.FAST2SMS_TEMPLATE_BODY.replace('{otp}', otp);

  const body = new URLSearchParams({
    sender_id: config.FAST2SMS_SENDER_ID,
    message,
    template_id: config.FAST2SMS_TEMPLATE_ID,
    entity_id: config.FAST2SMS_ENTITY_ID,
    route: 'dlt_manual',
    numbers: number,
  });

  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: config.FAST2SMS_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  let data: Fast2SmsResponse = {};
  try { data = await res.json() as Fast2SmsResponse; } catch { /* ignore parse failure */ }

  if (!res.ok || data.return === false) {
    const m = Array.isArray(data.message) ? data.message.join('; ') : (data.message || `HTTP ${res.status}`);
    throw new Error(`Fast2SMS send failed: ${m}`);
  }
  return { requestId: data.request_id };
}
