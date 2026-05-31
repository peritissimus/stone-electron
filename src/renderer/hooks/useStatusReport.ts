/**
 * useStatusReport — UI hook surface for the weekly status report
 * generator. Wraps the store so components don't import it directly.
 */

import { useStatusReportStore } from '@renderer/stores/statusReportStore';

export function useStatusReport() {
  const open = useStatusReportStore((s) => s.open);
  const generating = useStatusReportStore((s) => s.generating);
  const sending = useStatusReportStore((s) => s.sending);
  const result = useStatusReportStore((s) => s.result);
  const error = useStatusReportStore((s) => s.error);

  const openAndGenerate = useStatusReportStore((s) => s.openAndGenerate);
  const regenerate = useStatusReportStore((s) => s.regenerate);
  const close = useStatusReportStore((s) => s.close);
  const sendToJournal = useStatusReportStore((s) => s.sendToJournal);

  return {
    open,
    generating,
    sending,
    result,
    error,
    openAndGenerate,
    regenerate,
    close,
    sendToJournal,
  };
}
