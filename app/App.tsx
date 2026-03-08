import { useState } from 'react';
import { Toaster } from './components/ui/sonner';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './components/ui/resizable';
import { Editor } from './components/Editor';
import { AIChat } from './components/AIChat';
import { BackupsList, Backup } from './components/BackupsList';
import { useBackups } from './hooks/useBackups';
import { toast } from 'sonner';

export default function App() {
  const { backups, addBackup, deleteBackup } = useBackups();
  const [inputText, setInputText] = useState('');
  const [processedText, setProcessedText] = useState('');

  const handleSaveBackup = (text: string, processed: string) => {
    addBackup(text, processed);
  };

  const handleRestoreBackup = (backup: Backup) => {
    setInputText(backup.inputText);
    setProcessedText(backup.processedText);
    toast.success('Бекап восстановлен');
  };

  const handleDeleteBackup = (id: string) => {
    deleteBackup(id);
    toast.success('Бекап удален');
  };

  return (
    <div className="h-screen w-screen bg-background">
      <ResizablePanelGroup direction="horizontal">
        {/* Левая панель - Бекапы */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <BackupsList
            backups={backups}
            onRestore={handleRestoreBackup}
            onDelete={handleDeleteBackup}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Центральная панель - Редактор */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <Editor
            onSaveBackup={handleSaveBackup}
            inputText={inputText}
            processedText={processedText}
            onInputChange={setInputText}
            onProcessedChange={setProcessedText}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Правая панель - ИИ Чат */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <AIChat />
        </ResizablePanel>
      </ResizablePanelGroup>

      <Toaster position="bottom-right" />
    </div>
  );
}