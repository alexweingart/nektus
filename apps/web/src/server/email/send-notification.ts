import { Resend } from 'resend';

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

interface EventNotificationParams {
  toEmail: string;
  organizerName: string;
  eventTitle: string;
  dateString: string;        // e.g. "Tuesday, Feb 25"
  timeString: string;        // e.g. "2:00 PM - 2:30 PM"
  locationName?: string;
  locationAddress?: string;
  inviteCode: string;
}

export async function sendEventNotification(params: EventNotificationParams): Promise<{ success: boolean; error?: string }> {
  const {
    toEmail,
    organizerName,
    eventTitle,
    dateString,
    timeString,
    locationName,
    locationAddress,
    inviteCode,
  } = params;

  const inviteUrl = `https://nekt.us/i/${inviteCode}`;

  const locationHtml = locationName
    ? `
        <tr>
          <td style="padding: 4px 0; color: #b0b8c9; font-size: 14px;">${locationName}</td>
        </tr>
        ${locationAddress ? `<tr><td style="padding: 0 0 4px; color: #8892a6; font-size: 13px;">${locationAddress}</td></tr>` : ''}
      `
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0a0f1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0f1a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px;">
          <!-- Logo -->
          <tr>
            <td style="padding-bottom: 32px;">
              <img src="https://nekt.us/pwa/nektus-logo-pwa-192x192.png" alt="Nekt" width="48" height="48" style="border-radius: 12px;">
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding-bottom: 24px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">You have a new event!</h1>
            </td>
          </tr>

          <!-- Event Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #141b2d; border-radius: 16px; border: 1px solid #1e2940;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 4px; color: #ffffff; font-size: 18px; font-weight: 600;">${eventTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding-bottom: 16px; color: #b0b8c9; font-size: 14px;">with ${organizerName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #b0b8c9; font-size: 14px;">${dateString}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #b0b8c9; font-size: 14px;">${timeString}</td>
                      </tr>
                      ${locationHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding-top: 28px;" align="center">
              <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #71E454, #E7FED2); color: #0a0f1a; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 12px;">
                Add to your Calendar
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 40px; border-top: 1px solid #1e2940; margin-top: 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-top: 20px; color: #5a6478; font-size: 12px; text-align: center;">
                    Scheduled via <a href="https://nekt.us" style="color: #71E454; text-decoration: none;">Nekt</a> &middot; nekt.us
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const { error } = await getResend().emails.send({
      from: 'Nekt <nektbot@nekt.us>',
      to: toEmail,
      subject: `${organizerName} scheduled ${eventTitle} with you`,
      html,
    });

    if (error) {
      console.error('[Notification Email] Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Notification Email] Sent to ${toEmail} for event "${eventTitle}"`);
    return { success: true };
  } catch (err) {
    console.error('[Notification Email] Failed to send:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
