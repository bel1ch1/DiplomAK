import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Trash2, Download, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface Backup {
  id: string;
  inputText: string;
  processedText: string;
  timestamp: Date;
}

interface BackupsListProps {
  backups: Backup[];
  onRestore: (backup: Backup) => void;
  onDelete: (id: string) => void;
}

export function BackupsList({ backups, onRestore, onDelete }: BackupsListProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5" />
          Бекапы ({backups.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full pr-4">
          {backups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Clock className="size-8 mb-2 opacity-50" />
              <p className="text-sm">Нет сохраненных бекапов</p>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {backup.inputText.slice(0, 50)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(backup.timestamp), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => onRestore(backup)}
                    >
                      <Download className="size-3 mr-1" />
                      Восстановить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(backup.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
