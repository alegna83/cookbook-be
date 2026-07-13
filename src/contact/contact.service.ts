import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { EmailService } from 'src/auth/email.service';
import { ContactRequestDto } from './contact-request.dto';

@Injectable()
export class ContactService {
  private readonly receiverEmail =
    process.env.CONTACT_RECEIVER_EMAIL?.trim() ||
    'stays4pilgrims.camino@gmail.com';

  constructor(private readonly emailService: EmailService) {}

  async sendContactMessage(payload: ContactRequestDto): Promise<{ message: string }> {
    const name = payload.name?.trim();
    const email = payload.email?.trim();
    const phone = payload.phone?.trim();
    const title = payload.title?.trim();
    const message = payload.message?.trim();

    if (!name || !email || !title || !message) {
      throw new BadRequestException('name, email, title and message are required.');
    }

    if (!this.isValidEmail(email)) {
      throw new BadRequestException('email must be a valid email address.');
    }

    if (title.length > 120) {
      throw new BadRequestException('title must be 120 characters or less.');
    }

    if (message.length > 4000) {
      throw new BadRequestException('message must be 4000 characters or less.');
    }

    const html = this.buildEmailHtml({ name, email, phone, title, message });
    const subject = `[Contact] ${title}`;

    const result = await this.emailService.sendCustomEmail(this.receiverEmail, subject, html);

    if (
      result?.message === 'Email delivery disabled by configuration' ||
      String(result?.id ?? '').startsWith('noop-')
    ) {
      throw new InternalServerErrorException(
        'Contact email delivery is disabled in the backend configuration.',
      );
    }

    return { message: 'Your message has been sent successfully.' };
  }

  private buildEmailHtml(data: {
    name: string;
    email: string;
    phone?: string;
    title: string;
    message: string;
  }): string {
    const escapeHtml = (value: string) =>
      value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    const phoneRow = data.phone
      ? `
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Phone</td>
          <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.phone)}</td>
        </tr>
      `
      : '';

    return `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin: 0 0 16px; color: #0f172a;">New contact message</h2>
        <p style="margin: 0 0 16px;">A user submitted a message through the contact form.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tbody>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Name</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.name)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Email</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.email)}</td>
            </tr>
            ${phoneRow}
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Title</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb;">${escapeHtml(data.title)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; font-weight: 700; background: #f8fafc; width: 180px;">Message</td>
              <td style="padding: 10px 12px; border: 1px solid #e5e7eb; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
