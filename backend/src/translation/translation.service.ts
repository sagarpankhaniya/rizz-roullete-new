import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TranslationResult {
  translatedText: string;
  detectedLanguage: string;
}

/** BCP-47 codes allowed for chat translation targets. */
const ALLOWED_LANGUAGES = new Set([
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'hi',
  'it',
  'ja',
  'ko',
  'pt',
  'ru',
  'th',
  'tr',
  'vi',
  'zh-hans',
  'zh-hant',
]);

/**
 * Server-side Azure AI Translator client.
 * API keys never leave the backend — clients only send a target language code.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly apiKey: string | null;
  private readonly region: string | null;
  private readonly endpoint: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('translation.apiKey') || null;
    this.region = this.config.get<string>('translation.region') || null;
    this.endpoint = (
      this.config.get<string>('translation.endpoint') ||
      'https://api.cognitive.microsofttranslator.com'
    ).replace(/\/$/, '');

    if (!this.apiKey || !this.region) {
      this.logger.warn(
        'AZURE_TRANSLATOR_KEY / AZURE_TRANSLATOR_REGION not set — chat translation disabled.',
      );
    }
  }

  get isEnabled(): boolean {
    return Boolean(this.apiKey && this.region);
  }

  normalizeLanguageCode(code: string): string | null {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return null;
    const normalized = trimmed.replace('_', '-');
    if (!ALLOWED_LANGUAGES.has(normalized)) return null;
    return normalized;
  }

  async translate(
    text: string,
    toLanguage: string,
  ): Promise<TranslationResult | null> {
    if (!this.isEnabled) return null;

    const to = this.normalizeLanguageCode(toLanguage);
    if (!to) return null;

    const url = `${this.endpoint}/translate?api-version=3.0&to=${encodeURIComponent(to)}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey!,
          'Ocp-Apim-Subscription-Region': this.region!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ text }]),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`Azure Translator returned HTTP ${res.status}`);
        return null;
      }

      const data = (await res.json()) as Array<{
        detectedLanguage?: { language: string };
        translations?: Array<{ text: string }>;
      }>;

      const item = data[0];
      const translatedText = item?.translations?.[0]?.text?.trim();
      const detectedLanguage =
        item?.detectedLanguage?.language?.toLowerCase() ?? '';

      if (!translatedText) return null;

      const toBase = to.split('-')[0];
      const detectedBase = detectedLanguage.split('-')[0];
      if (toBase === detectedBase) return null;

      return { translatedText, detectedLanguage };
    } catch (error) {
      this.logger.warn(`Translation request failed: ${(error as Error).message}`);
      return null;
    }
  }
}
