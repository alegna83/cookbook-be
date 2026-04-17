import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AccommodationsService } from '../accommodations/accommodations.service';

@Injectable()
export class SuggestionService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly accommodationsService: AccommodationsService,
  ) {}

  async sugerirLugares(prompt: string): Promise<string> {
    console.log('Função sugerirLugares chamada com o prompt:', prompt);
    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    console.log('API Key:', apiKey);
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: 'openai/gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `Responde como um guia turístico. Dá apenas uma lista de 3 locais turísticos desportivos perto das coordenadas indicadas (num raio máximo de 5 km), com o nome e as coordenadas no formato: "Nome, latitude, longitude". Não escrevas mais nada.

                Exemplo:
                Estádio do Dragão, 41.1621, -8.5830
                Pavilhão Rosa Mota, 41.1456, -8.6153
                Parque da Cidade, 41.1701, -8.6756

                Segue este formato.`,
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 500,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost',
              'X-Title': 'suggestion-module',
            },
          },
        ),
      );

      console.log('Resposta da API:', response); // Exibe a resposta completa para verificação

      console.log(
        'Mensagem completa:',
        JSON.stringify(response.data.choices[0].message, null, 2),
      );

      // Verifica se o conteúdo da resposta existe e extrai
      const fullText =
        response.data?.choices?.[0]?.message?.content ??
        response.data?.message?.content ??
        JSON.stringify(response.data);

      if (!fullText) {
        throw new Error('Resposta vazia do modelo OpenRouter');
      }

      console.log('Conteúdo completo da resposta:', fullText); // Exibe o conteúdo para verificação

      // Extrair as linhas com coordenadas
      const resultLines = fullText
        .trim()
        .split('\n')
        .filter((line) => line.match(/-?\d+\.\d+/));

      console.log('Linhas com coordenadas:', resultLines); // Exibe as linhas com coordenadas

      // Seleciona as últimas 3 linhas com coordenadas (ou menos, se houver menos resultados)
      const shortResult = resultLines.slice(0, 3).join('\n');

      // Caso não haja resultados válidos, lança um erro
      if (!shortResult) {
        throw new Error('Resposta inválida ou vazia do modelo OpenRouter');
      }

      return shortResult;
    } catch (error) {
      // Exibe o erro caso a requisição falhe
      console.error(
        'Erro ao fazer a requisição:',
        error.response?.data || error.message,
      );
      throw new Error('Erro ao obter dados do modelo OpenRouter');
    }
  }

  /**
   * Sugere o melhor albergue próximo das coordenadas fornecidas.
   * Critérios: categoria "Albergue", status aprovado, mais alta avaliação (ou outro critério disponível).
   */
  async sugerirMelhorAlbergue(
    lat: number,
    lon: number,
    raioKm: number = 10,
  ): Promise<any> {
    // Definir limites de latitude/longitude para o raio
    const delta = raioKm / 111; // Aproximação: 1 grau ~ 111km
    const bounds = {
      south: lat - delta,
      north: lat + delta,
      west: lon - delta,
      east: lon + delta,
    };
    // Buscar acomodações dentro do raio
    const acoms = await this.accommodationsService.getByBounds(bounds);
    if (!acoms.length) {
      return { message: 'No accommodations found in the area.' };
    }
    // Montar lista de nomes e endereços para enviar à IA
    const placesList = acoms
      .map((a) => `${a.place_name}${a.address ? ', ' + a.address : ''}`)
      .join('\n');

    // Prompt para IA cruzar dados e sugerir o melhor
    const prompt = `Given the following list of hostels/accommodations registered in the system (with name and address):\n${placesList}\nBased on up-to-date information from the internet (reviews, reputation, etc.), which is the best hostel/accommodation for a traveler? Reply ONLY with the name (and address if possible) of the best one from the list above. Do not suggest any place that is not in the list.`;

    // Chamar IA para obter sugestão
    const iaResponse = await this.sugerirLugares(prompt);

    // Procurar o local sugerido na lista original para devolver o objeto completo
    const match = acoms.find((a) =>
      iaResponse.toLowerCase().includes(a.place_name?.toLowerCase() || '')
    );
    if (match) {
      return match;
    }
    // Se não encontrar correspondência exata, retorna resposta da IA
    return { iaSuggestion: iaResponse, message: 'No exact match found in database.' };
  }
}
