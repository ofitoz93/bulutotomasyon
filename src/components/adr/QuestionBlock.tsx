
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
            ? colorClass + " ring-2 ring-offset-1 ring-" + colorClass.split("-")[1] + "-500"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"}
    `;

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
            <p className="font-medium text-gray-900 mb-3">{question.text}</p>

            <div className="flex gap-2">
                {question.type === 'yes_no' && (
                    <>
                        <button type="button" onClick={() => handleSelect("Evet")} className={btnClass("Evet", "bg-green-100 text-green-800 border-green-200")}>
                            Evet
                        </button>
                        <button type="button" onClick={() => handleSelect("Hayır")} className={btnClass("Hayır", "bg-red-100 text-red-800 border-red-200")}>
                            Hayır
                        </button>
                    </>
                )}

                {question.type === 'yes_no_partial' && (
                    <>
                        <button type="button" onClick={() => handleSelect("Evet")} className={btnClass("Evet", "bg-green-100 text-green-800 border-green-200")}>
                            Evet
                        </button>
                        <button type="button" onClick={() => handleSelect("Kısmen")} className={btnClass("Kısmen", "bg-yellow-100 text-yellow-800 border-yellow-200")}>
                            Kısmen
                        </button>
                        <button type="button" onClick={() => handleSelect("Hayır")} className={btnClass("Hayır", "bg-red-100 text-red-800 border-red-200")}>
                            Hayır
                        </button>
                    </>
                )}

                {question.type === 'suitable_unsuitable' && (
                    <>
                        <button type="button" onClick={() => handleSelect("Uygun")} className={btnClass("Uygun", "bg-green-100 text-green-800 border-green-200")}>
                            Uygun
                        </button>
                        <button type="button" onClick={() => handleSelect("Uygun Değil")} className={btnClass("Uygun Değil", "bg-red-100 text-red-800 border-red-200")}>
                            Uygun Değil
                        </button>
                    </>
                )}

                {question.type === 'checkbox' && (
                    <label className="flex items-center space-x-3 cursor-pointer p-2 rounded hover:bg-gray-50 flex-1">
                        <input
                            type="checkbox"
                            checked={value?.result === "Evet"}
                            onChange={(e) => handleSelect(e.target.checked ? "Evet" : "Hayır")}
                            className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">Onaylıyorum / Kontrol Edildi</span>
                    </label>
                )}
            </div>

            {error && <p className="text-red-500 text-xs mt-2">{error.result?.message || "Bu alan zorunludur"}</p>}
        </div>
    );
}
