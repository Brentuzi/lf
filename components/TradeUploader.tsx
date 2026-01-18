import { ChangeEvent } from "react";

type TradeUploaderProps = {
  value: string;
  onChange: (value: string) => void;
  onParse: () => void;
  errors: string[];
  maxChars: number;
  maxFileBytes: number;
  onError: (message: string) => void;
};

export const TradeUploader = ({
  value,
  onChange,
  onParse,
  errors,
  maxChars,
  maxFileBytes,
  onError,
}: TradeUploaderProps) => {
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > maxFileBytes) {
      onError(
        `Файл слишком большой. Максимум ${(maxFileBytes / 1024 / 1024).toFixed(
          1,
        )} МБ.`,
      );
      return;
    }
    const text = await file.text();
    onChange(text);
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/30">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            Загрузка истории торгов
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Вставьте текст или загрузите файл CSV/TSV. Формат как в вашем
            примере.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500">
            <input
              type="file"
              accept=".txt,.csv,.tsv"
              className="hidden"
              onChange={handleFile}
            />
            Загрузить файл
          </label>
          <button
            type="button"
            onClick={onParse}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Обработать
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (nextValue.length > maxChars) {
            onError(
              `Слишком много данных. Лимит ${maxChars.toLocaleString("ru-RU")} символов.`,
            );
            onChange(nextValue.slice(0, maxChars));
            return;
          }
          onChange(nextValue);
        }}
        placeholder="Вставьте сюда историю торгов..."
        className="mt-4 h-56 w-full resize-none rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-100 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
      />
      <p className="mt-2 text-xs text-slate-500">
        {value.length.toLocaleString("ru-RU")} /{" "}
        {maxChars.toLocaleString("ru-RU")} символов
      </p>
      {errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
          <p className="font-semibold">Ошибки разбора:</p>
          <ul className="mt-2 space-y-1">
            {errors.slice(0, 5).map((error) => (
              <li key={error}>• {error}</li>
            ))}
            {errors.length > 5 && (
              <li>… и ещё {errors.length - 5}</li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
};
