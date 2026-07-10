import { BadRequestException, Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { lookup as dnsLookup } from 'node:dns/promises';
import { Resend } from 'resend';

type EmailProvider = 'smtp' | 'resend';
type ResolvedEmailProvider = EmailProvider | 'noop';

@Injectable()
export class EmailService {
  private readonly provider: ResolvedEmailProvider;
  private readonly fromEmail: string;
  private readonly resend?: Resend;
  private transporter?: Transporter;
  private smtpConfig?: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } };
  private readonly isDevelopment = process.env.NODE_ENV === 'development';
  private readonly bypassEmailVerification = process.env.BYPASS_EMAIL_VERIFICATION === 'true';

  constructor() {
    this.provider = this.resolveProvider();
    this.fromEmail = this.resolveFromEmail();

    if (this.shouldFallbackToSmtp()) {
      console.warn(
        '[EmailService] Resend is configured with the test sender. Falling back to SMTP so verification emails can actually be delivered.',
      );
    }

    if (this.provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY?.trim();
      if (!apiKey) {
        throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend');
      }

      this.resend = new Resend(apiKey);
      return;
    }

    if (this.provider === 'smtp') {
      const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
      const port = Number(process.env.SMTP_PORT ?? 465);
      const secure = this.parseBoolean(process.env.SMTP_SECURE, port === 465);
      const user = process.env.SMTP_USER?.trim();
      const pass = process.env.SMTP_PASS?.trim();

      if (!user || !pass) {
        throw new Error('SMTP_USER and SMTP_PASS are required when EMAIL_PROVIDER=smtp');
      }

      // Store SMTP config and create transporter lazily at send time.
      this.smtpConfig = { host, port, secure, auth: { user, pass } };

      return;
    }

    console.warn(
      '[EmailService] No email provider credentials configured. Email sending will be disabled, but the app will continue to boot.',
    );
  }

  async sendEmailVerificationEmail(
    email: string,
    name: string,
    verificationToken: string,
    verificationUrl: string,
  ): Promise<any> {
    if (this.bypassEmailVerification && this.isDevelopment) {
      console.log(
        `[EmailService] DEV BYPASS: verification email not sent to ${email}. Token=${verificationToken.substring(0, 8)}...`,
      );
      return { id: `dev-${Date.now()}`, message: 'DEV: Email bypassed' };
    }

    return this.sendEmail(
      email,
      'Verify your email - Stays4Pilgrims',
      this.getVerificationEmailTemplate(name, verificationUrl),
    );
  }

  async sendWelcomeEmail(email: string, name: string): Promise<any> {
    return this.sendEmail(
      email,
      'Welcome to Stays4Pilgrims!',
      this.getWelcomeEmailTemplate(name),
    );
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetToken: string,
    resetUrl: string,
  ): Promise<any> {
    return this.sendEmail(
      email,
      'Reset your password - Stays4Pilgrims',
      this.getPasswordResetTemplate(name, resetUrl),
    );
  }

  private async sendEmail(email: string, subject: string, html: string): Promise<any> {
    try {
      if (this.provider === 'noop') {
        console.warn(
          `[EmailService] Email disabled. Skipping send to ${email} with subject: ${subject}`,
        );
        return {
          id: `noop-${Date.now()}`,
          message: 'Email delivery disabled by configuration',
        };
      }

      if (this.provider === 'resend') {
        return await this.sendWithResend(email, subject, html);
      }

      return await this.sendWithSmtp(email, subject, html);
    } catch (error) {
      console.error('[EmailService] Error sending email:', error);
      throw error;
    }
  }

  private async sendWithResend(email: string, subject: string, html: string): Promise<any> {
    if (!this.resend) {
      throw new Error('Resend client is not configured.');
    }

    if (this.isUsingResendTestSender() && !this.bypassEmailVerification) {
      console.warn(
        '[EmailService] Using Resend test sender (onboarding@resend.dev). This is allowed temporarily for testing, but you should switch to a verified domain sender for production.',
      );
    }

    try {
      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: email,
        subject,
        html,
      });

      if ((result as any)?.error) {
        this.throwOrRethrowResendError((result as any).error, email);
      }

      return result;
    } catch (error) {
      this.throwOrRethrowResendError(error, email);
    }
  }

  private async sendWithSmtp(email: string, subject: string, html: string): Promise<any> {
    if (!this.transporter) {
      if (!this.smtpConfig) {
        throw new Error('SMTP transporter is not configured.');
      }

      let resolvedHost = this.smtpConfig.host;
      try {
        const lookup = await dnsLookup(this.smtpConfig.host, { family: 4 });
        resolvedHost = lookup.address;
      } catch (err) {
        console.warn('[EmailService] Could not resolve IPv4 for SMTP host, falling back to configured host', err?.message || err);
      }

      this.transporter = nodemailer.createTransport({
        host: resolvedHost,
        port: this.smtpConfig.port,
        secure: this.smtpConfig.secure,
        auth: this.smtpConfig.auth,
        tls: { servername: this.smtpConfig.host },
      });
    }

    const info = await this.transporter.sendMail({
      from: this.fromEmail,
      to: email,
      subject,
      html,
    });

    console.log('[EmailService] SMTP sendMail result:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    return info;
  }

  private resolveProvider(): ResolvedEmailProvider {
    const configured = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
    const hasResend = Boolean(process.env.RESEND_API_KEY?.trim());
    const hasSmtp = Boolean(
      process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim(),
    );

    // Force using SMTP if SMTP credentials are present. This ensures environments
    // with SMTP configured will always use SMTP (even if RESEND is available).
    if (hasSmtp) return 'smtp';

    if (configured === 'resend') {
      return hasResend ? 'resend' : 'noop';
    }

    if (configured === 'smtp') {
      return hasSmtp ? 'smtp' : hasResend ? 'resend' : 'noop';
    }

    if (hasResend) return 'resend';
    return 'noop';
  }

  private resolveFromEmail(): string {
    if (this.provider === 'smtp') {
      const smtpUser = process.env.SMTP_USER?.trim();
      return (
        process.env.SMTP_FROM?.trim() ||
        process.env.EMAIL_FROM?.trim() ||
        (smtpUser ? `Stays4Pilgrims <${smtpUser}>` : 'Stays4Pilgrims <stays4pilgrims@gmail.com>')
      );
    }

    return process.env.RESEND_FROM_EMAIL?.trim() || 'Stays4Pilgrims <onboarding@resend.dev>';
  }

  private shouldFallbackToSmtp(): boolean {
    return this.provider === 'smtp' && this.isConfiguredResendTestSender() && this.hasSmtpCredentials();
  }

  private hasSmtpCredentials(): boolean {
    return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
  }

  private isConfiguredResendTestSender(): boolean {
    const configuredFrom = process.env.RESEND_FROM_EMAIL?.trim().toLowerCase();
    if (!configuredFrom) {
      return true;
    }

    return configuredFrom.includes('onboarding@resend.dev') || configuredFrom.includes('@resend.dev');
  }

  private parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value == null) return defaultValue;
    return value.trim().toLowerCase() === 'true';
  }

  private isUsingResendTestSender(): boolean {
    const normalizedFrom = this.fromEmail.toLowerCase();
    return normalizedFrom.includes('onboarding@resend.dev') || normalizedFrom.includes('@resend.dev');
  }

  private throwOrRethrowResendError(error: any, email: string): never {
    console.error('[EmailService] Resend email error:', error);

    const errorMessage = String(error?.message || error?.response?.message || '').toLowerCase();
    const isTestSenderRestriction =
      error?.statusCode === 403 &&
      error?.name === 'validation_error' &&
      errorMessage.includes('only send testing emails') &&
      errorMessage.includes('verify a domain');

    if (isTestSenderRestriction) {
      throw new BadRequestException(
        `Resend is using the test sender and cannot send verification emails to ${email}. Use a verified domain sender in RESEND_FROM_EMAIL or switch to SMTP.`,
      );
    }

    throw new Error(error?.message || error?.response?.message || JSON.stringify(error));
  }

  private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
            .token-warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 15px 0; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
              <div class="header">
              <h1>Welcome to Stays4Pilgrims!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Thank you for signing up! To complete your registration, please verify your email address by clicking the button below:</p>
              <a href="${verificationUrl}" class="button">Verify Email</a>
              <p>Or copy and paste this link in your browser:</p>
              <p style="word-break: break-all;"><small>${verificationUrl}</small></p>
              <div class="token-warning">
                <strong>⏱️ Important:</strong> This link will expire in 24 hours. If it expires, you can request a new verification email from the login page.
              </div>
              <p>If you didn't create this account, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Stays4Pilgrims. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome Aboard!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>Your email has been successfully verified! You can now log in and start exploring Camino Places.</p>
              <p>Happy pilgrimaging! 🥾</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Stays4Pilgrims. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getPasswordResetTemplate(name: string, resetUrl: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
            .button { display: inline-block; background: #e55353; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Stays4Pilgrims</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>We received a request to reset your password. Click the button below to set a new password:</p>
              <a href="${resetUrl}" class="button">Reset Password</a>
              <p>If you didn't request this, you can safely ignore this email.</p>
              <p style="word-break: break-all;"><small>${resetUrl}</small></p>
              <div class="footer">
                <p>&copy; 2026 Camino Places. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
