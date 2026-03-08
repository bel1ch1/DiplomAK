import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Send, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Здравствуйте! Я помощник научного редактора. Могу помочь с улучшением стиля, проверкой терминологии и структуры текста. Чем могу помочь?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getMockResponse = (userMessage: string): string => {
    const lowercaseMsg = userMessage.toLowerCase();

    if (lowercaseMsg.includes('привет') || lowercaseMsg.includes('здравствуй')) {
      return 'Здравствуйте! Готов помочь с редактированием вашего научного текста.';
    }

    if (lowercaseMsg.includes('как') && (lowercaseMsg.includes('улучшить') || lowercaseMsg.includes('исправить'))) {
      return 'Для улучшения научного текста рекомендую:\n\n1. Использовать точную терминологию\n2. Избегать канцеляризмов\n3. Структурировать текст логически\n4. Проверить согласованность времен\n5. Убедиться в правильности ссылок';
    }

    if (lowercaseMsg.includes('стиль') || lowercaseMsg.includes('оформлени')) {
      return 'Научный стиль предполагает:\n- Объективность изложения\n- Использование терминов\n- Безличные конструкции\n- Логическую последовательность\n- Точность формулировок';
    }

    if (lowercaseMsg.includes('ссылк') || lowercaseMsg.includes('цитиров')) {
      return 'Для оформления ссылок обычно используются стандарты ГОСТ или международные (APA, IEEE). Убедитесь, что все источники указаны в списке литературы и правильно процитированы в тексте.';
    }

    if (lowercaseMsg.includes('терминолог') || lowercaseMsg.includes('термин')) {
      return 'При работе с терминологией важно:\n- Использовать устоявшиеся термины в вашей области\n- Определять новые или специфические термины\n- Быть последовательным в использовании терминов\n- Избегать синонимов для ключевых понятий';
    }

    return 'Интересный вопрос! Для более точного ответа, пожалуйста, уточните, с каким аспектом редактирования вам нужна помощь: стиль, структура, терминология или оформление?';
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Имитация ответа ИИ
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getMockResponse(input),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="size-5" />
          Чат с ИИ-помощником
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div
                  className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="size-4" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </div>
                <div
                  className={`flex-1 rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 size-8 rounded-full bg-muted flex items-center justify-center">
                  <Bot className="size-4" />
                </div>
                <div className="rounded-lg p-3 bg-muted">
                  <div className="flex gap-1">
                    <div className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Задайте вопрос..."
            disabled={isTyping}
          />
          <Button onClick={handleSend} disabled={!input.trim() || isTyping}>
            <Send className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
