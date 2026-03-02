
import type { QuestionDefinition } from "@/types/adr";
import { useWatch, type UseFormRegister, type UseFormSetValue } from "react-hook-form";

interface QuestionBlockProps {
    question: QuestionDefinition;
    register: UseFormRegister<any>;
    setValue: UseFormSetValue<any>;
    control: any;
    error?: any;
}

export default function QuestionBlock({ question, setValue, control, error }: QuestionBlockProps) {
    const value = useWatch({ control, name: `answers.${question.key}` });

    const handleSelect = (val: string) => {
        setValue(`answers.${question.key}`, { result: val });
    };

    const isSelected = (val: string) => value?.result === val;

    const btnClass = (val: string, colorClass: string) => `
        flex-1 py-3 px-2 rounded-md font-medium text-sm transition-colors border
        ${isSelected(val)
            ? colorClass + " ring-2 ring-offset-1 ring-offset-slate-900 ring-" + colorClass.split("-")[1] + "-500/50 shadow-lg"
            : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"}
    `;

    return (
        <div className="bg-slate-900 p-4 rounded-lg shadow-sm border border-slate-800">
            <p className="font-medium text-slate-200 mb-3">{question.text}</p>

            <div className="flex gap-2">
                {question.type === 'yes_no' && (
                    <>
                        <button type="button" onClick={() => handleSelect("Evet")} className={btnClass("Evet", "bg-emerald-500/20 text-emerald-400 border-emerald-500/30")}>
                            Evet
                        </button>
                        <button type="button" onClick={() => handleSelect("Hayır")} className={btnClass("Hayır", "bg-rose-500/20 text-rose-400 border-rose-500/30")}>
                            Hayır
                        </button>
                    </>
                )}

                {question.type === 'yes_no_partial' && (
                    <>
                        <button type="button" onClick={() => handleSelect("Evet")} className={btnClass("Evet", "bg-emerald-500/20 text-emerald-400 border-emerald-500/30")}>
                            Evet
                        </button>
                        <button type="button" onClick={() => handleSelect("Kısmen")} className={btnClass("Kısmen", "bg-amber-500/20 text-amber-400 border-amber-500/30")}>
                            Kısmen
                        </button>
                        <button type="button" onClick={() => handleSelect("Hayır")} className={btnClass("Hayır", "bg-rose-500/20 text-rose-400 border-rose-500/30")}>
                            Hayır
                        </button>
                    </>
                )}

                {question.type === 'suitable_unsuitable' && (
                    <>
                        <button type="button" onClick={() => handleSelect("Uygun")} className={btnClass("Uygun", "bg-emerald-500/20 text-emerald-400 border-emerald-500/30")}>
                            Uygun
                        </button>
                        <button type="button" onClick={() => handleSelect("Uygun Değil")} className={btnClass("Uygun Değil", "bg-rose-500/20 text-rose-400 border-rose-500/30")}>
                            Uygun Değil
                        </button>
                    </>
                )}

                {question.type === 'checkbox' && (
                    <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-slate-800 flex-1 transition-colors">
                        <input
                            type="checkbox"
                            checked={value?.result === "Evet"}
                            onChange={(e) => handleSelect(e.target.checked ? "Evet" : "Hayır")}
                            className="h-5 w-5 text-indigo-500 rounded border-slate-700 bg-slate-800 focus:ring-indigo-500 focus:ring-offset-slate-900"
                        />
                        <span className="text-sm text-slate-300">Onaylıyorum / Kontrol Edildi</span>
                    </label>
                )}
            </div>

            {error && <p className="text-rose-500 text-xs mt-2">{error.result?.message || "Bu alan zorunludur"}</p>}
        </div>
    );
}
