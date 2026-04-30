import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AccommodationsService } from '../accommodations/accommodations.service';
import { CommentsService } from '../comments/comments.service';

@Injectable()
export class SuggestionService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly accommodationsService: AccommodationsService,
    private readonly commentsService: CommentsService,
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        'Erro ao fazer a requisição:',
        error instanceof Error && error.message.includes('response') ? (error as any).response?.data : errorMsg,
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

  /**
   * Proposes the best hostel/accommodation near the provided coordinates.
   * Criteria: Approved status, highest database rating, and user reviews.
   * Combines database information with AI analysis from internet reviews.
   *
   * @param lat - Latitude of the search center
   * @param lon - Longitude of the search center
   * @param radiusKm - Search radius in kilometers (default: 10)
   * @param categoryName - Filter by accommodation category name, e.g., 'Hostel', 'Hotel' (optional)
   * @returns Best accommodation suggestion with rating information
   */
  async suggestBestAccommodation(
    lat: number,
    lon: number,
    radiusKm: number = 10,
    categoryName?: string,
  ): Promise<any> {
      try {
        // Calculate geographic bounds
        const delta = radiusKm / 111; // Approximation: 1 degree ~ 111 km
        const bounds = {
          south: lat - delta,
          north: lat + delta,
          west: lon - delta,
          east: lon + delta,
        };

        // Fetch accommodations within radius
        let accommodations = await this.accommodationsService.getByBounds(bounds);

        if (!accommodations?.length) {
          return {
            success: false,
            message: 'No accommodations found in the specified area.',
          };
        }

        // Filter by category if specified
        if (categoryName) {
          accommodations = accommodations.filter(
            (a) =>
              a.place_category?.name?.toLowerCase() === categoryName.toLowerCase(),
          );

          if (!accommodations.length) {
            return {
              success: false,
              message: `No accommodations found in category "${categoryName}" within the search area.`,
            };
          }
        }

        // Enrich each accommodation with database ratings
        const enrichedAccommodations = await Promise.all(
          accommodations.map(async (accommodation) => {
            const stats = await this.commentsService.getStats(accommodation.id);
            return {
              id: accommodation.id,
              name: accommodation.place_name,
              address: accommodation.address,
              website: accommodation.website,
              phone: accommodation.phone,
              email: accommodation.email,
              latitude: accommodation.latitude,
              longitude: accommodation.longitude,
              services: accommodation.services || [],
              category: accommodation.place_category?.name || 'Unknown',
              averageRating: stats.average || 0,
              reviewCount: stats.count || 0,
              ratingDisplay: stats.count > 0 ? `${stats.average}/5 (${stats.count} reviews)` : 'No ratings yet',
            };
          }),
        );

        // Sort by rating descending (highest first)
        enrichedAccommodations.sort((a, b) => b.averageRating - a.averageRating);

        // Separate accommodations with ratings from those without
        const ratedAccommodations = enrichedAccommodations.filter(
          (acc) => acc.reviewCount > 0 && acc.averageRating >= 3.0,
        );
        const unratedAccommodations = enrichedAccommodations.filter(
          (acc) => acc.reviewCount === 0 || acc.averageRating < 3.0,
        );

        // If there are rated accommodations, use only those for recommendation
        // Otherwise fall back to unrated ones
        const primaryOptions = ratedAccommodations.length > 0 ? ratedAccommodations : enrichedAccommodations;
        const fallbackOptions = ratedAccommodations.length > 0 ? unratedAccommodations : [];

        // Prepare accommodation list for AI analysis
        const accommodationList = primaryOptions
          .map(
            (acc) =>
              `${acc.name} (${acc.address}) - Rating: ${acc.ratingDisplay} - Services: ${acc.services.join(', ') || 'Not specified'}`,
          )
          .join('\n');

        // Create enriched prompt for AI with stricter rating-based criteria
        const aiPrompt = `You are a travel advisor recommending accommodations based on ACTUAL GUEST RATINGS.

Your ONLY job: Select the accommodation with the HIGHEST combined score of:
- Rating score (4.0+ is excellent, 3.5+ is very good, 3.0+ is good)
- Number of verified guest reviews (more reviews = higher confidence)

DO NOT consider location, services, or marketing. ONLY rating and review count matter.
If multiple have the same rating, pick the one with MORE reviews.

Available accommodations (SORTED BY RATING):
${accommodationList}

Reply ONLY with the accommodation name from the list. Nothing else.`;

        // Call AI for enhanced recommendation
        const aiResponse = await this.callAI(aiPrompt, 'Based on guest ratings and verified reviews, select the best accommodation.');

        // Find the matched accommodation from AI response
        const recommendedAccommodation = primaryOptions.find((acc) =>
          aiResponse.toLowerCase().includes(acc.name.toLowerCase()),
        );

        if (recommendedAccommodation) {
          return {
            success: true,
            recommendation: recommendedAccommodation,
            allOptions: enrichedAccommodations,
            reasoning: `Selected based on ${recommendedAccommodation.reviewCount > 0 ? `${recommendedAccommodation.reviewCount} verified guest reviews with ${recommendedAccommodation.averageRating.toFixed(1)}/5 average rating` : 'best available option'}`,
          };
        }

        // If no exact match found from AI, use top-rated accommodation from primary options
        const bestOption = primaryOptions.length > 0 ? primaryOptions[0] : enrichedAccommodations[0];
        return {
          success: true,
          recommendation: bestOption,
          allOptions: enrichedAccommodations,
          reasoning: `Recommended based on ${bestOption.reviewCount > 0 ? `${bestOption.reviewCount} guest reviews averaging ${bestOption.averageRating.toFixed(1)}/5 rating` : 'availability'}`,
        };
      } catch (error) {
        console.error('Error in suggestBestAccommodation:', error instanceof Error ? error.message : String(error));
        throw new Error(`Failed to suggest best accommodation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    /**
     * Internal helper method to call OpenRouter AI API
     * @param userPrompt - The user/system prompt content
     * @param systemContext - System context for the AI
     * @returns AI response text
     */
    private async callAI(userPrompt: string, systemContext: string = 'You are a helpful travel assistant.'): Promise<string> {
      const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');

      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY not configured');
      }

      try {
        const response = await firstValueFrom(
          this.httpService.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
              model: 'openai/gpt-3.5-turbo',
              messages: [
                {
                  role: 'system',
                  content: systemContext,
                },
                { role: 'user', content: userPrompt },
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

        const responseText =
          response.data?.choices?.[0]?.message?.content ||
          response.data?.message?.content ||
          '';

        if (!responseText) {
          throw new Error('Empty response from OpenRouter API');
        }

        return responseText.trim();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const responseData = (error as any)?.response?.data;
        console.error('AI API call failed:', responseData || errorMsg);
        throw new Error(`AI API error: ${errorMsg}`);
      }
    }
  }
