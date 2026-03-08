import { useState, useEffect } from 'react';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FileText, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface EditorProps {
  onSaveBackup: (text: string, processedText: string) => void;
  inputText: string;
  processedText: string;
  onInputChange: (text: string) => void;
  onProcessedChange: (text: string) => void;
}

export function Editor({ onSaveBackup, inputText, processedText, onInputChange, onProcessedChange }: EditorProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Функция обработки текста (научное редактирование)
  const processText = (text: string): string => {
    if (!text.trim()) return '';

    let processed = text;

    // Исправление двойных пробелов
    processed = processed.replace(/\s+/g, ' ');

    // Исправление кавычек на типографские
    processed = processed.replace(/"([^"]*)"/g, '«$1»');

    // Исправление тире
    processed = processed.replace(/\s-\s/g, ' — ');

    // Удаление лишних пробелов перед знаками препинания
    processed = processed.replace(/\s+([.,;:!?])/g, '$1');

    // Заглавная буква после точки
    processed = processed.replace(/\.\s+([а-яa-z])/gi, (match, letter) => {
      return '. ' + letter.toUpperCase();
    });

    // Заглавная буква в начале
    if (processed.length > 0) {
      processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    }

    return processed;
  };

  const handleProcess = () => {
    setIsProcessing(true);
    
    // Имитация обработки с небольшой задержкой
    setTimeout(() => {
      const result = processText(inputText);
      onProcessedChange(result);
      setIsProcessing(false);
      toast.success('Текст обработан');
    }, 500);
  };

  const handleSave = () => {
    if (!inputText.trim()) {
      toast.error('Нечего сохранять');
      return;
    }
    onSaveBackup(inputText, processedText);
    toast.success('Бекап сохранен');
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-6" />
          <h1 className="text-2xl font-semibold">Научный редактор</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleProcess} disabled={isProcessing || !inputText.trim()}>
            <RefreshCw className={`size-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
            Обработать текст
          </Button>
          <Button onClick={handleSave} variant="outline">
            <Save className="size-4 mr-2" />
            Сохранить бекап
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Исходный текст</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <Textarea
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Вставьте текст для редактирования..."
              className="h-full resize-none font-mono"
            />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Обработанный текст</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <Textarea
              value={processedText}
              onChange={(e) => onProcessedChange(e.target.value)}
              placeholder="Обработанный текст появится здесь..."
              className="h-full resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}