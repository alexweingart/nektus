import { ServerProfileService } from '@/server/profile/create';
import { getInitials, stringToColor } from '@/client/profile/avatar';

export default async function EmailPreviewPage() {
  // Fetch a real profile by email
  const result = await ServerProfileService.findProfileByEmail("ajweingart@gmail.com");
  const profile = result?.profile || null;

  const organizerFullName = profile?.contactEntries?.find(e => e.fieldType === 'name')?.value || "Alex Weingart";
  const organizerFirstName = organizerFullName.split(' ')[0];
  const organizerPhoto = profile?.profileImage || "";
  const organizerShortCode = profile?.shortCode || "demo";

  const eventTitle = "Coffee Chat";
  const dateString = "Tuesday, Mar 4";
  const timeString = "2:00 PM";
  const locationName = "Blue Bottle Coffee";
  const inviteUrl = "https://nekt.us/i/abc123";
  const profileUrl = `https://nekt.us/c/${organizerShortCode}`;

  // --- Email envelope metadata ---
  const emailMeta = {
    from: "Nektbot <nektbot@nekt.us>",
    to: "jamie@example.com",
    // Subject: ~35 chars max for mobile (name + event)
    subject: `${eventTitle} with ${organizerFirstName} 🤝`,
    // Preview: ~50 chars max (date, time, location)
    previewText: `Tue 3/4 at ${timeString} · ${locationName}`,
  };

  const mapsQuery = encodeURIComponent(locationName);
  const mapsUrl = `https://maps.google.com/?q=${mapsQuery}`;

  const locationHtml = locationName
    ? `
        <tr>
          <td style="padding: 4px 0; color: #d1d5db; font-size: 16px;">📍 <a href="${mapsUrl}" style="color: #71E454; text-decoration: underline;">${locationName}</a></td>
        </tr>
      `
    : '';

  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <style>
    /* Hidden preview text */
    .preview-text { display: none; font-size: 1px; color: #0a0f1a; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0f1a; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preview text for inbox -->
  <div class="preview-text">${emailMeta.previewText}</div>

  <!-- Outer wrapper with gradient background matching homepage -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #0a0f1a 0%, #145835 40%, #145835 60%, #0a0f1a 100%); min-height: 100%;">
    <tr>
      <td align="center" style="padding: 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="https://nekt.us/pwa/nektus-logo-pwa-192x192.png" alt="Nekt" width="56" height="56" style="border-radius: 14px;">
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td align="center" style="padding-bottom: 8px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700;">It's on! 🔥</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <p style="margin: 0; color: #c0c8d8; font-size: 18px; font-weight: 700;"><a href="${profileUrl}" style="color: #71E454; text-decoration: none;">${organizerFirstName}</a> wants to hang out with you</p>
            </td>
          </tr>

          <!-- Event Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); border-collapse: separate;">
                <tr>
                  <td style="padding: 24px; background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%), rgba(0,0,0,0.6); border-radius: 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-bottom: 4px; color: #ffffff; font-size: 24px; font-weight: 700;">${eventTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #d1d5db; font-size: 16px;">✨ <a href="${profileUrl}" style="color: #d1d5db; text-decoration: none;">${organizerFullName}</a> &amp; you</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #d1d5db; font-size: 16px;">📅 ${dateString} at ${timeString}</td>
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
              <a href="${inviteUrl}" style="display: inline-block; background-color: #ffffff; color: #0a0f1a; font-size: 20px; font-weight: 700; text-decoration: none; padding: 16px 40px; border-radius: 50px;">
                Lock it in
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 40px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-top: 20px; color: #9ca3af; font-size: 12px; text-align: center;">
                    Scheduled with <a href="https://nekt.us" style="color: #71E454; text-decoration: none;">Nekt</a>
                    <br><br>This is a one-time notification. No further emails will be sent unless someone schedules another event.
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

  return (
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-white text-xl font-semibold mb-2">Email Preview</h1>
        <p className="text-gray-500 text-sm mb-6">
          Using profile: <span className="text-gray-300">{organizerFullName}</span>
          {organizerPhoto ? ' ✓ photo' : ' (no photo)'}
          {' · '}nekt.us/c/{organizerShortCode}
        </p>

        {/* Email Metadata */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mb-6 font-mono text-sm space-y-2">
          <div className="flex">
            <span className="text-gray-500 w-24 shrink-0">From</span>
            <span className="text-white">{emailMeta.from}</span>
          </div>
          <div className="flex">
            <span className="text-gray-500 w-24 shrink-0">To</span>
            <span className="text-white">{emailMeta.to}</span>
          </div>
          <div className="flex">
            <span className="text-gray-500 w-24 shrink-0">Subject</span>
            <span className="text-white font-semibold">{emailMeta.subject}</span>
          </div>
          <div className="border-t border-gray-700 my-2" />
          <div className="flex">
            <span className="text-gray-500 w-24 shrink-0">Preview</span>
            <span className="text-gray-400 italic">{emailMeta.previewText}</span>
          </div>
        </div>

        {/* Email Body */}
        <div className="border border-gray-700 rounded-xl overflow-hidden">
          <iframe
            srcDoc={emailHtml}
            className="w-full"
            style={{ height: 820, border: 'none' }}
            title="Email Preview"
          />
        </div>

        <p className="text-gray-500 text-xs mt-4 text-center">
          Change shortCode at top of page to preview different profiles
        </p>
      </div>
    </div>
  );
}
