import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './account.entity';
import * as bcrypt from 'bcryptjs';
import { EmailService } from '../auth/email.service';
import * as crypto from 'crypto';

const PILGRIM_REASON_OPTIONS = [
  'Spiritual and Religious',
  'Self-discovery and Mental Health',
  'Overcoming and Physical Challenge',
  'Culture and Nature',
  'Socialization',
  'Other',
] as const;

const PILGRIM_REASON_LEGACY_MAP: Record<string, string> = {
  'motivos espirituais e religiosos': 'Spiritual and Religious',
  'autoconhecimento e saúde mental': 'Self-discovery and Mental Health',
  'autoconhecimento e saude mental': 'Self-discovery and Mental Health',
  'superação e desafio físico': 'Overcoming and Physical Challenge',
  'superacao e desafio fisico': 'Overcoming and Physical Challenge',
  'cultura e natureza': 'Culture and Nature',
  'socialização': 'Socialization',
  'socializacao': 'Socialization',
};

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
    private emailService: EmailService,
  ) {}

  // Função para registar um novo utilizador - com verificação de email
  async register(
    email: string,
    name: string,
    password: string,
    pilgrim_reason: string,
    pilgrim_reason_other?: string,
  ): Promise<{ account: Account; message: string }> {
    // Verificar se o utilizador já existe
    const existingAccount = await this.accountsRepository.findOne({
      where: { email },
    });
    if (existingAccount) {
      throw new Error('Este e-mail já está registado.');
    }

    // Gerar o hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Gerar token de verificação de email
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    // Criar o novo utilizador com isEmailVerified = false
    const newAccount = this.accountsRepository.create({
      email,
      name,
      password: hashedPassword,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationTokenExpiry: verificationTokenExpiry,
      ...this.normalizePilgrimReason(pilgrim_reason, pilgrim_reason_other),
    });

    const savedAccount = await this.accountsRepository.save(newAccount);

    // Enviar email de verificação
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await this.emailService.sendEmailVerificationEmail(
      email,
      name,
      verificationToken,
      verificationUrl,
    );

    return {
      account: savedAccount,
      message: 'Registration successful! Please check your email to verify your account.',
    };
  }

  async findByEmail(email: string): Promise<Account | null> {
    return this.accountsRepository.findOne({
      where: { email },
      select: [
        'id',
        'email',
        'name',
        'pilgrim_reason',
        'pilgrim_reason_other',
        'password',
        'userType',
        'avatar',
      ],
    });
  }

  async updateAccount(accountId: number, data: Partial<Account>): Promise<Account> {
    console.log(`[SERVICE] updateAccount() called for accountId=${accountId}`);
    console.log('[SERVICE] Update data keys:', Object.keys(data).filter(k => data[k] !== undefined));

    const account = await this.accountsRepository.findOne({ where: { id: accountId } });
    if (!account) {
      throw new Error('Account not found.');
    }

    console.log('[SERVICE] Before update:', {
      id: account.id,
      name: account.name,
      avatar: account.avatar ? 'exists (length: ' + account.avatar.length + ')' : 'null',
    });

    if (data.name !== undefined) {
      console.log('[SERVICE] Updating name from', account.name, 'to', data.name);
      account.name = data.name as any;
    }
    if (data.pilgrim_reason !== undefined || (data as any).pilgrim_reason_other !== undefined) {
      const normalizedReason = this.normalizePilgrimReason(
        data.pilgrim_reason,
        (data as any).pilgrim_reason_other,
      );
      console.log('[SERVICE] Updating pilgrim reason to', normalizedReason);
      account.pilgrim_reason = normalizedReason.pilgrim_reason;
      account.pilgrim_reason_other = normalizedReason.pilgrim_reason_other;
    }
    if ((data as any).avatar !== undefined) {
      console.log('[SERVICE] Updating avatar from', account.avatar ? 'exists' : 'null', 'to', (data as any).avatar ? 'exists (length: ' + (data as any).avatar.length + ')' : 'null');
      account.avatar = (data as any).avatar;
    }

    console.log('[SERVICE] After update (before save):', {
      id: account.id,
      name: account.name,
      avatar: account.avatar ? 'exists' : 'null',
    });

    const saved = await this.accountsRepository.save(account);
    
    console.log('[SERVICE] After save:', {
      id: saved.id,
      name: saved.name,
      avatar: saved.avatar ? 'exists (length: ' + saved.avatar.length + ')' : 'null',
    });

    return saved;
  }

  private normalizePilgrimReason(
    reason?: string | null,
    reasonOther?: string | null,
  ) {
    const rawReason = (reason ?? '').trim();
    const rawOther = (reasonOther ?? '').trim();
    const mappedReason =
      PILGRIM_REASON_LEGACY_MAP[rawReason.toLowerCase()] ?? rawReason;
    const selectedReason = PILGRIM_REASON_OPTIONS.includes(
      mappedReason as (typeof PILGRIM_REASON_OPTIONS)[number],
    )
      ? mappedReason
      : rawReason
        ? 'Other'
        : null;

    return {
      pilgrim_reason: selectedReason,
      pilgrim_reason_other:
        selectedReason === 'Other'
          ? rawOther || (mappedReason && mappedReason !== 'Other' ? rawReason : null)
          : null,
    };
  }

  // Verificar token de email e marcar email como verificado
  async verifyEmail(token: string): Promise<Account> {
    const account = await this.accountsRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!account) {
      throw new Error('Invalid verification token.');
    }

    // Verificar se o token expirou
    if (!account.emailVerificationTokenExpiry || account.emailVerificationTokenExpiry < new Date()) {
      throw new Error('Verification token has expired. Please request a new verification email.');
    }

    // Marcar email como verificado
    account.isEmailVerified = true;
    account.emailVerificationToken = null;
    account.emailVerificationTokenExpiry = null;

    const savedAccount = await this.accountsRepository.save(account);

    // Enviar email de boas-vindas
    await this.emailService.sendWelcomeEmail(account.email, account.name);

    return savedAccount;
  }

  // Re-enviar email de verificação
  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const account = await this.accountsRepository.findOne({
      where: { email },
    });

    if (!account) {
      throw new Error('Account not found.');
    }

    if (account.isEmailVerified) {
      throw new Error('This email is already verified.');
    }

    // Gerar novo token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

    account.emailVerificationToken = verificationToken;
    account.emailVerificationTokenExpiry = verificationTokenExpiry;

    await this.accountsRepository.save(account);

    // Enviar novo email de verificação
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await this.emailService.sendEmailVerificationEmail(
      email,
      account.name,
      verificationToken,
      verificationUrl,
    );

    return {
      message: 'Verification email sent! Please check your email.',
    };
  }

  // Função para autenticar o usuário
  async login(email: string, password: string): Promise<Account> {
    console.log('login no accounts');
    const account = await this.accountsRepository.findOne({ where: { email } });
    if (!account) {
      throw new Error('Account not found.');
    }

    // Verificar se o email foi verificado
    if (!account.isEmailVerified) {
      throw new Error('Please verify your email before logging in.');
    }

    const isPasswordValid = password === account.password; //await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      throw new Error('Wrong password.');
    }

    return account;
  }
}
