import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'

export default function DeleteConfirmDialog({ fileName, onClose, onConfirm }) {
  const { t } = useI18n()
  const ref = useRef(null)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={ref}
        className="w-full max-w-sm rounded-lg border bg-popover p-6 shadow-lg"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center size-10 rounded-full bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{t('deleteTitle')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{t('deleteConfirm')}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4 truncate">"{fileName}"</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {t('delete')}
          </Button>
        </div>
      </div>
    </div>
  )
}
