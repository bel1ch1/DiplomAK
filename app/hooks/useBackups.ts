import { useState, useEffect } from 'react';
import { Backup } from '../components/BackupsList';

const STORAGE_KEY = 'scientific-editor-backups';

export function useBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);

  // Загрузка бекапов из localStorage при монтировании
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Преобразуем строки дат обратно в объекты Date
        const withDates = parsed.map((backup: any) => ({
          ...backup,
          timestamp: new Date(backup.timestamp),
        }));
        setBackups(withDates);
      } catch (error) {
        console.error('Ошибка загрузки бекапов:', error);
      }
    }
  }, []);

  // Сохранение бекапов в localStorage при изменении
  useEffect(() => {
    if (backups.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(backups));
    }
  }, [backups]);

  const addBackup = (inputText: string, processedText: string) => {
    const newBackup: Backup = {
      id: Date.now().toString(),
      inputText,
      processedText,
      timestamp: new Date(),
    };
    setBackups((prev) => [newBackup, ...prev]);
  };

  const deleteBackup = (id: string) => {
    setBackups((prev) => {
      const filtered = prev.filter((backup) => backup.id !== id);
      if (filtered.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
      }
      return filtered;
    });
  };

  const clearAllBackups = () => {
    setBackups([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    backups,
    addBackup,
    deleteBackup,
    clearAllBackups,
  };
}
