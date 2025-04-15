import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from './account.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
  ) {}

  // Função para registrar um novo usuário
  async register(
    email: string,
    password: string,
    pilgrim_reason: string,
  ): Promise<Account> {
    // Verificar se o usuário já existe
    const existingAccount = await this.accountsRepository.findOne({
      where: { email },
    });
    if (existingAccount) {
      throw new Error('Este e-mail já está registado.');
    }

    // Gerar o hash da senha
    //const hashedPassword = await bcrypt.hash(password, 10);
    const hashedPassword = password;

    // Criar o novo usuário
    const newAccount = this.accountsRepository.create({
      email,
      password: hashedPassword,
      pilgrim_reason
    });

    // Salvar no banco de dados
    return this.accountsRepository.save(newAccount);
  }

  async findByEmail(email: string): Promise<Account | null> { 
    return await this.accountsRepository.findOne({ where: { email } });
  }

  // Função para autenticar o usuário
  async login(email: string, password: string): Promise<Account> {
    console.log("login no accounts");
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
