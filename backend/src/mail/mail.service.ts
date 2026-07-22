import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type BrevoSender = { name: string; email: string };

function parseFrom(from: string): BrevoSender {
  const match = from.match(/^\s*(.+?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: 'Rizz', email: from.trim() };
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string | null;
  private readonly sender: BrevoSender;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('mail.brevoApiKey') || null;
    this.sender = parseFrom(
      this.config.get<string>('mail.from') ?? 'Rizz <sagarjpdev@gmail.com>',
    );

    if (!this.apiKey) {
      this.logger.warn(
        'BREVO_API_KEY not set. Invite emails will be logged only.',
      );
    }
  }

  async sendCreatorInvite(to: string, inviteUrl: string): Promise<void> {
    const subject = 'You’re invited to join Rizz as a Creator';
    const htmlContent = `
      <div style="margin:0;padding:32px 16px;background:#120812;background-image:radial-gradient(circle at top, rgba(255,45,122,0.24), transparent 34%), radial-gradient(circle at bottom right, rgba(255,140,190,0.18), transparent 28%);font-family:Outfit,Arial,sans-serif;line-height:1.5;color:#fff0f7;">
        <div style="max-width:620px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:18px;">
            <div style="display:inline-block;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#ffd5e8;">
              Creator Invite
            </div>
          </div>
          <div style="border-radius:28px;padding:36px 30px;background:rgba(22,12,24,0.82);border:1px solid rgba(255,255,255,0.1);box-shadow:0 18px 54px rgba(0,0,0,0.35);backdrop-filter:blur(10px);">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#ff9bc4;">
              Moderated Mode
            </p>
            <h1 style="margin:0 0 14px;font-family:Fraunces,Georgia,serif;font-size:38px;line-height:1.05;color:#fff0f7;">
              You’re Invited to Rizz
            </h1>
            <p style="margin:0 0 18px;font-size:17px;color:rgba(255,240,247,0.88);">
              Create your Creator account to unlock VIP access and jump straight into the Rizz experience.
            </p>
            <div style="margin:22px 0 26px;padding:18px 18px 16px;border-radius:20px;background:linear-gradient(135deg, rgba(255,45,122,0.14), rgba(255,255,255,0.05));border:1px solid rgba(255,140,190,0.28);">
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#fff0f7;">
                What you get
              </p>
              <p style="margin:0;font-size:14px;color:rgba(255,240,247,0.8);">
                One-time invite, VIP badge on video calls, and instant access to the same signup flow used on the landing page.
              </p>
            </div>
            <p style="margin:0 0 22px;">
              <a href="${inviteUrl}" style="display:inline-block;padding:14px 22px;background:linear-gradient(135deg,#ff2d7a,#ff6aa8);color:#fff;text-decoration:none;border-radius:999px;font-weight:800;font-size:15px;letter-spacing:0.01em;box-shadow:0 10px 24px rgba(255,45,122,0.35);">
                Create your account
              </a>
            </p>
            <p style="margin:0 0 12px;font-size:13px;color:#ffd1e5;">
              This invite can only be used once.
            </p>
            <div style="padding:14px 16px;border-radius:16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#ff9bc4;">
                Direct link
              </p>
              <p style="margin:0;font-size:12px;word-break:break-all;color:rgba(255,240,247,0.7);">
                ${inviteUrl}
              </p>
            </div>
          </div>
          <p style="margin:16px auto 0;max-width:560px;text-align:center;font-size:12px;color:rgba(255,240,247,0.58);">
            Rizz Roulette creator access
          </p>
        </div>
      </div>
    `;

    if (!this.apiKey) {
      this.logger.log(`[dev] Creator invite for ${to}: ${inviteUrl}`);
      return;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify({
        sender: this.sender,
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
      code?: string;
    };

    if (!res.ok) {
      const message =
        body.message || `Brevo error ${res.status}: failed to send email`;
      this.logger.error(`Failed to send invite to ${to}: ${message}`);
      throw new Error(message);
    }

    this.logger.log(
      `Creator invite email sent to ${to} (id=${body.messageId ?? 'ok'})`,
    );
  }

  async sendUnbanRequest(input: {
    adminEmail: string;
    userEmail: string;
    userId: string;
    firstName: string;
    banReason: string | null;
    bannedAt: Date | null;
  }): Promise<void> {
    const bannedAtLabel = input.bannedAt
      ? new Date(input.bannedAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
        })
      : 'Unknown';
    const reason = input.banReason?.trim() || 'Not specified';
    const subject = `Unban request — ${input.firstName} (${input.userEmail})`;
    const htmlContent = `
      <div style="margin:0;padding:32px 16px;background:#120812;background-image:radial-gradient(circle at top, rgba(255,45,122,0.24), transparent 34%), radial-gradient(circle at bottom right, rgba(255,140,190,0.18), transparent 28%);font-family:Outfit,Arial,sans-serif;line-height:1.5;color:#fff0f7;">
        <div style="max-width:620px;margin:0 auto;">
          <div style="text-align:center;margin-bottom:18px;">
            <div style="display:inline-block;padding:7px 14px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#ffd5e8;">
              Unban Request
            </div>
          </div>
          <div style="border-radius:28px;padding:36px 30px;background:rgba(22,12,24,0.82);border:1px solid rgba(255,255,255,0.1);box-shadow:0 18px 54px rgba(0,0,0,0.35);">
            <h1 style="margin:0 0 14px;font-family:Fraunces,Georgia,serif;font-size:34px;line-height:1.05;color:#fff0f7;">
              User requested ban removal
            </h1>
            <p style="margin:0 0 18px;font-size:16px;color:rgba(255,240,247,0.88);">
              A banned account asked an admin to review and remove their ban.
            </p>
            <div style="margin:22px 0 8px;padding:18px;border-radius:20px;background:linear-gradient(135deg, rgba(255,45,122,0.14), rgba(255,255,255,0.05));border:1px solid rgba(255,140,190,0.28);">
              <p style="margin:0 0 10px;font-size:14px;"><strong>Name:</strong> ${input.firstName}</p>
              <p style="margin:0 0 10px;font-size:14px;"><strong>Email:</strong> ${input.userEmail}</p>
              <p style="margin:0 0 10px;font-size:14px;"><strong>User ID:</strong> ${input.userId}</p>
              <p style="margin:0 0 10px;font-size:14px;"><strong>Banned at:</strong> ${bannedAtLabel}</p>
              <p style="margin:0;font-size:14px;"><strong>Ban reason:</strong> ${reason}</p>
            </div>
            <p style="margin:18px 0 0;font-size:13px;color:rgba(255,240,247,0.7);">
              Please review this account in the admin tools and unban if appropriate.
            </p>
          </div>
        </div>
      </div>
    `;

    if (!this.apiKey) {
      this.logger.log(
        `[dev] Unban request for ${input.userEmail} → ${input.adminEmail}`,
      );
      return;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify({
        sender: this.sender,
        to: [{ email: input.adminEmail }],
        replyTo: { email: input.userEmail, name: input.firstName },
        subject,
        htmlContent,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      message?: string;
    };

    if (!res.ok) {
      const message =
        body.message || `Brevo error ${res.status}: failed to send email`;
      this.logger.error(
        `Failed to send unban request for ${input.userEmail}: ${message}`,
      );
      throw new Error(message);
    }

    this.logger.log(
      `Unban request email sent for ${input.userEmail} → ${input.adminEmail} (id=${body.messageId ?? 'ok'})`,
    );
  }
}
