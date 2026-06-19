import { env } from '../config/env.js';

export interface EmailProvider {
  sendInvitation(to: string, name: string, inviteLink: string): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  async sendInvitation(to: string, name: string, inviteLink: string): Promise<void> {
    console.log('\n========== EMAIL INVITATION ==========');
    console.log(`To: ${to}`);
    console.log(`Name: ${name}`);
    console.log(`Link: ${inviteLink}`);
    console.log('=======================================\n');
  }
}

class ResendEmailProvider implements EmailProvider {
  async sendInvitation(to: string, name: string, inviteLink: string): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY not configured');

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to,
        subject: 'Undangan Bergabung - AISI',
        html: `
          <h2>Assalamu'alaikum ${name},</h2>
          <p>Anda diundang untuk bergabung ke Aplikasi AISI.</p>
          <p><a href="${inviteLink}">Klik di sini untuk membuat password</a></p>
          <p>Link berlaku 7 hari.</p>
        `,
      }),
    });
  }
}

export const emailProvider: EmailProvider = process.env.RESEND_API_KEY
  ? new ResendEmailProvider()
  : new ConsoleEmailProvider();
