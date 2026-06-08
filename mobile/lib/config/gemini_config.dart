const geminiApiKey = String.fromEnvironment('GEMINI_API_KEY');
const geminiModel = String.fromEnvironment(
  'GEMINI_MODEL',
  defaultValue: 'gemini-1.5-flash',
);

bool get isGeminiConfigured => geminiApiKey.isNotEmpty;
