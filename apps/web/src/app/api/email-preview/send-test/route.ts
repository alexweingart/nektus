import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { ServerProfileService } from '@/server/profile/create';

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev only' }, { status: 403 });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 });
  }

  // Fetch real profile
  const result = await ServerProfileService.findProfileByEmail("ajweingart@gmail.com");
  const profile = result?.profile || null;

  const organizerFullName = profile?.contactEntries?.find(e => e.fieldType === 'name')?.value || "Alex Weingart";
  const organizerFirstName = organizerFullName.split(' ')[0];
  const organizerShortCode = profile?.shortCode || "demo";

  const eventTitle = "Coffee Chat";
  const dateString = "Tuesday, Mar 4";
  const timeString = "2:00 PM";
  const locationName = "Blue Bottle Coffee";
  const inviteUrl = "https://nekt.us/i/abc123";
  const profileUrl = `https://nekt.us/c/${organizerShortCode}`;

  // Inline SVG icons as data URIs (white, 16x16)
  const icons = {
    people: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" viewBox="0 0 16 16"><path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"/></svg>')}`,
    calendar: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>')}`,
    mapPin: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>')}`,
  };
  const iconImg = (src: string) => `<img src="${src}" width="16" height="16" style="vertical-align: middle; margin-right: 6px; display: inline-block;">`;

  const mapsQuery = encodeURIComponent(locationName);
  const mapsUrl = `https://maps.google.com/?q=${mapsQuery}`;

  const locationHtml = locationName
    ? `
        <tr>
          <td style="padding: 4px 0; color: #d1d5db; font-size: 16px;">${iconImg(icons.mapPin)}<a href="${mapsUrl}" style="color: #71E454; text-decoration: underline;">${locationName}</a></td>
        </tr>
      `
    : '';

  const subject = `${eventTitle} with ${organizerFirstName} 🤝`;
  const previewText = `Tue 3/4 at ${timeString} · ${locationName}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <style>
    .preview-text { display: none; font-size: 1px; color: #0a0f1a; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0f1a; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div class="preview-text">${previewText}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(180deg, #0a0f1a 0%, #145835 40%, #145835 60%, #0a0f1a 100%); min-height: 100%;">
    <tr>
      <td align="center" style="padding: 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px;">

          <tr>
            <td align="center" style="padding-bottom: 12px;">
              <img src="https://nekt.us/pwa/nektus-logo-pwa-192x192.png" alt="Nekt" width="56" height="56" style="border-radius: 14px;">
            </td>
          </tr>

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
                        <td style="padding: 4px 0; color: #d1d5db; font-size: 16px;">${iconImg(icons.people)}<a href="${profileUrl}" style="color: #d1d5db; text-decoration: none;">${organizerFullName}</a> &amp; you</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; color: #d1d5db; font-size: 16px;">${iconImg(icons.calendar)}${dateString} at ${timeString}</td>
                      </tr>
                      ${locationHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding-top: 28px;" align="center">
              <a href="${inviteUrl}" style="display: inline-block; background-color: #ffffff; color: #0a0f1a; font-size: 20px; font-weight: 700; text-decoration: none; padding: 16px 40px; border-radius: 50px;">
                Lock it in
              </a>
            </td>
          </tr>

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

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: 'Nektbot <nektbot@nekt.us>',
      to: 'ajweingart@gmail.com',
      subject,
      html,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, subject });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
