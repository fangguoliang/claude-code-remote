import { ref } from 'vue';

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
}

const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function useVoiceInput(options: UseVoiceInputOptions = { onTranscript: () => {} }) {
  const isSupported = ref(!!SpeechRecognitionCtor);
  const isListening = ref(false);
  const transcript = ref('');
  const language = ref(options.language || 'zh-CN');
  const error = ref<string | null>(null);

  let recognition: SpeechRecognition | null = null;
  let finalTranscript = '';
  let activelyListening = false;

  function startListening() {
    if (!isSupported.value || !SpeechRecognitionCtor) return;

    try {
      recognition = new SpeechRecognitionCtor();
      const rec = recognition!;
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = language.value;
      finalTranscript = '';
      activelyListening = true;

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        transcript.value = finalTranscript + interim;
      };

      rec.onerror = (event: { error: string }) => {
        activelyListening = false;
        isListening.value = false;
        if (event.error === 'not-allowed') {
          error.value = '麦克风权限被拒绝';
        } else if (event.error === 'no-speech') {
          error.value = '未检测到语音';
        } else {
          error.value = `语音识别错误: ${event.error}`;
        }
        options.onError?.(error.value);
      };

      rec.onend = () => {
        isListening.value = false;
        if (activelyListening && finalTranscript.trim()) {
          options.onTranscript(finalTranscript.trim());
        }
        activelyListening = false;
        recognition = null;
      };

      rec.onstart = () => {
        isListening.value = true;
        error.value = null;
      };

      rec.start();
    } catch (e) {
      error.value = '无法启动语音识别';
      options.onError?.(error.value);
    }
  }

  function stopListening() {
    if (recognition) {
      activelyListening = false;
      recognition.stop();
    }
  }

  function setLanguage(lang: string) {
    language.value = lang;
  }

  function cleanup() {
    if (recognition) {
      activelyListening = false;
      recognition.abort();
      recognition = null;
    }
    isListening.value = false;
  }

  return {
    isSupported,
    isListening,
    transcript,
    language,
    error,
    startListening,
    stopListening,
    setLanguage,
    cleanup,
  };
}
