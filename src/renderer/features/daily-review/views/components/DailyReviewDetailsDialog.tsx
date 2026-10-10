import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@renderer/components/base/ui/dialog';

export interface DailyReviewDetail {
  kind: string;
  title: string;
  fields: { label: string; value: string }[];
  body?: string | null;
}

export type ShowDailyReviewDetail = (detail: DailyReviewDetail, trigger: HTMLElement) => void;

export function DailyReviewDetailsDialog({
  detail,
  onClose,
  returnFocus,
}: {
  detail: DailyReviewDetail | null;
  onClose: () => void;
  returnFocus: () => void;
}) {
  return (
    <Dialog open={detail !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto [overflow-wrap:anywhere] [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:size-10 [&>button]:items-center [&>button]:justify-center"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <DialogDescription className="pr-10">{detail?.kind}</DialogDescription>
        <DialogTitle className="pr-10 leading-snug">{detail?.title}</DialogTitle>
        <dl className="space-y-3 text-sm">
          {detail?.fields.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
        {detail?.body && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{detail.body}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
