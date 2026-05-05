import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './account.entity';
import * as bcrypt from 'bcryptjs';

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
  ) {}

  // Função para registrar um novo usuário
  async register(
    email: string,
    name: string,
    password: string,
    pilgrim_reason: string,
    pilgrim_reason_other?: string,
  ): Promise<Account> {
    // Verificar se o usuário já existe
    const existingAccount = await this.accountsRepository.findOne({
      where: { email },
    });
    if (existingAccount) {
      throw new Error('Este e-mail já está registado.');
    }

    // Gerar o hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    //const hashedPassword = password;

    // Criar o novo usuário
    const newAccount = this.accountsRepository.create({
      email,
      name,
      password: hashedPassword,
      ...this.normalizePilgrimReason(pilgrim_reason, pilgrim_reason_other),
    });

    // Salvar no banco de dados
    return this.accountsRepository.save(newAccount);
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

  // Função para autenticar o usuário
  async login(email: string, password: string): Promise<Account> {
    console.log('login no accounts');
    const account = await this.accountsRepository.findOne({ where: { email } });
    if (!account) {
      throw new Error('Account not found.');
    }

    const isPasswordValid = password === account.password; //await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      throw new Error('Wrong password.');
    }

    return account;
  }
}
