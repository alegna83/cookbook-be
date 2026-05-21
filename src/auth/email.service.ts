import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmailVerificationEmail(
    email: string,
    name: string,
    verificationToken: string,
    verificationUrl: string,
  ): Promise<any> {
    try {
      const result = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Verify your email - Camino Places',
        html: this.getVerificationEmailTemplate(name, verificationUrl),
      });

      if (result.error) {
        console.error('Email send error:', result.error);
        throw new Error(`Failed to send verification email: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('Error sending verification email:', error);
      throw error;
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<any> {
    try {
      const result = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Welcome to Camino Places!',
        html: this.getWelcomeEmailTemplate(name),
      });

      if (result.error) {
        console.error('Email send error:', result.error);
        throw new Error(`Failed to send welcome email: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string, resetUrl: string): Promise<any> {
    try {
      const result = await this.resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Reset your password - Camino Places',
        html: this.getPasswordResetTemplate(name, resetUrl),
      });

      if (result.error) {
        console.error('Email send error:', result.error);
        throw new Error(`Failed to send password reset email: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
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
              <h1>Welcome to Camino Places!</h1>
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
              <p>&copy; 2026 Camino Places. All rights reserved.</p>
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
              <p>&copy; 2026 Camino Places. All rights reserved.</p>
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
          <style> body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 0 auto; padding: 20px; } .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; } .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; } .button { display: inline-block; background: #e55353; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; } .footer { text-align: center; font-size: 12px; color: #666; margin-top: 20px; } </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Camino Places</h1>
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
