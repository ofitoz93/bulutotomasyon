import { useEffect, useRef, useState, useCallback } from "react";
import SignaturePadLib from "signature_pad";
import { RotateCcw, CheckCircle } from "lucide-react";

interface SignaturePadProps {
    value?: string; // base64 data URL
    onChange: (dataUrl: string | null) => void;
    label?: string;
    required?: boolean;
}

export default function SignaturePad({ value, onChange, label = "İmza", required }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const padRef = useRef<SignaturePadLib | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [isSaved, setIsSaved] = useState(!!value);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !containerRef.current) return;
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = containerRef.current.offsetWidth;
        const height = 200;

        const data = padRef.current?.toData();
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.getContext("2d")?.scale(ratio, ratio);

        if (padRef.current) {
            padRef.current.clear();
            if (data && data.length > 0) {
                padRef.current.fromData(data);
            }
        }
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        padRef.current = new SignaturePadLib(canvas, {
            backgroundColor: "rgba(0,0,0,0)",
            penColor: "#e2e8f0",
            minWidth: 1.5,
            maxWidth: 3,
        });

        padRef.current.addEventListener("endStroke", () => {
            setIsEmpty(padRef.current?.isEmpty() ?? true);
            setIsSaved(false);
            onChange(null); // Reset saved state when drawing
        });

        resizeCanvas();

        // If there's a pre-existing value, draw it
        if (value) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
                }
            };
            img.src = value;
            setIsEmpty(false);
            setIsSaved(true);
        }

        window.addEventListener("resize", resizeCanvas);
        return () => {
            window.removeEventListener("resize", resizeCanvas);
            padRef.current?.off();
        };
    }, []);

    const handleClear = () => {
        padRef.current?.clear();
        setIsEmpty(true);
        setIsSaved(false);
        onChange(null);
    };

    const handleSave = () => {
        if (!padRef.current || padRef.current.isEmpty()) return;
        const dataUrl = padRef.current.toDataURL("image/png");
        onChange(dataUrl);
        setIsSaved(true);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-400">
                    {label}
                    {required && <span className="text-rose-400 ml-1">*</span>}
                </label>
                {!isEmpty && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-400 transition-colors"
                    >
                        <RotateCcw className="w-3 h-3" /> Temizle
                    </button>
                )}
            </div>

            <div
                ref={containerRef}
                className={`relative w-full rounded-lg border-2 transition-colors overflow-hidden ${
                    isSaved
                        ? "border-emerald-500/50 bg-slate-800/40"
                        : "border-dashed border-slate-600 bg-slate-800/80 hover:border-indigo-500/50"
                }`}
                style={{ height: 200, touchAction: "none" }}
            >
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 cursor-crosshair"
                    style={{ touchAction: "none" }}
                />
                {isEmpty && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                        <p className="text-slate-600 text-sm font-medium">Buraya imzanızı atın</p>
                        <p className="text-slate-700 text-xs mt-1">Parmağınız veya mouse ile çizin</p>
                    </div>
                )}
                {isSaved && (
                    <div className="absolute top-2 right-2 pointer-events-none">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                    </div>
                )}
            </div>

            {!isEmpty && !isSaved && (
                <button
                    type="button"
                    onClick={handleSave}
                    className="w-full py-2 mt-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
                >
                    İmzayı Onayla ve Kaydet
                </button>
            )}
            {isSaved && (
                <p className="text-xs text-center text-emerald-500 font-medium">✓ İmza kaydedildi</p>
            )}
        </div>
    );
}
