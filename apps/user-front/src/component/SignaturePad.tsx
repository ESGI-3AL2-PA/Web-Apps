import { useEffect, useRef, useState } from "react";

// Canvas HTML5 pour dessiner une signature à la souris ou au tactile.
// Renvoie le résultat en data-URL PNG ("data:image/png;base64,...") via `onSubmit`.
// Boutons "Effacer" + "Valider la signature" (désactivé si le canvas est vide).
type SignaturePadProps = {
  width?: number;
  height?: number;
  onSubmit: (dataUrl: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

const SignaturePad = ({
  width = 400,
  height = 150,
  onSubmit,
  onCancel,
  submitLabel = "Valider la signature",
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState<boolean>(false);
  const [isEmpty, setIsEmpty] = useState<boolean>(true);

  // Initialise le contexte (trait noir, smooth).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Fond blanc explicite (sinon transparent → mauvais rendu dans le PDF).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  // Convertit les coordonnées d'un event en coords canvas (gère mouse + touch).
  const getCoords = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0] ?? e.changedTouches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCoords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (isEmpty) setIsEmpty(false);
  };

  const stopDraw = () => setDrawing(false);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSubmit(dataUrl);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          border: "1px dashed #9ca3af",
          borderRadius: 6,
          background: "#fff",
          display: "inline-block",
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            cursor: "crosshair",
            display: "block",
            touchAction: "none",
            maxWidth: "100%",
          }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
        Dessine ta signature avec la souris ou le doigt.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            background: "#f3f4f6",
            color: "#111",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Effacer
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isEmpty}
          style={{
            background: isEmpty ? "#9ca3af" : "#10b981",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            cursor: isEmpty ? "not-allowed" : "pointer",
            fontSize: 13,
          }}
        >
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: "transparent",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Annuler
          </button>
        )}
      </div>
    </div>
  );
};

export default SignaturePad;
